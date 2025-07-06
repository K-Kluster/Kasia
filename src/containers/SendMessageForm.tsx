import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { Message } from "../types/all";
import { unknownErrorToErrorLike } from "../utils/errors";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  Textarea,
} from "@headlessui/react";
import { useWalletStore } from "../store/wallet.store";
import { Address } from "kaspa-wasm";
import { formatKasAmount } from "../utils/format";
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { toast } from "../utils/toast";
import { SendPayment } from "./SendPayment";
import clsx from "clsx";
import { PriorityFeeSelector } from "../components/PriorityFeeSelector";
import { PriorityFeeConfig } from "../types/all";
import { FeeSource } from "kaspa-wasm";
import { useUiStore } from "../store/ui.store";
import { Modal } from "../components/Common/modal";
import { Button } from "../components/Common/Button";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { MAX_PAYLOAD_SIZE } from "../config/constants";
import { prepareFileForUpload } from "../utils/upload-file-handler";

type SendMessageFormProps = {
  onExpand?: () => void;
};

// Arbritary fee levels to colour the fee indicator in chat
const FEE_LEVELS = [
  { limit: 0.00002, classes: "text-green-400 border-green-400" },
  { limit: 0.00005, classes: "text-blue-400  border-blue-400" },
  { limit: 0.0005, classes: "text-yellow-400 border-yellow-400" },
  { limit: 0.001, classes: "text-orange-400 border-orange-400" },
  { limit: Infinity, classes: "text-red-400 border-red-400" },
];

function getFeeClasses(fee: number) {
  return FEE_LEVELS.find(({ limit }) => fee <= limit)!.classes;
}

export const SendMessageForm: FC<SendMessageFormProps> = ({ onExpand }) => {
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const walletStore = useWalletStore();
  const [feeEstimate, setFeeEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [priorityFee, setPriorityFee] = useState<PriorityFeeConfig>({
    amount: BigInt(0),
    source: FeeSource.SenderPays,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const { isOpen, closeModal, openModal } = useUiStore();

  const messageStore = useMessagingStore();

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = () => fileInputRef.current?.click();

  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.value = "";
      setMessage("");
    }
  }, []);

  const estimateFee = useCallback(async () => {
    if (!walletStore.unlockedWallet) {
      console.log("Cannot estimate fee: missing wallet");
      return;
    }

    if (!message || !openedRecipient) {
      console.log("Cannot estimate fee: missing message or recipient");
      return;
    }

    try {
      console.log("Estimating fee for message:", {
        length: message.length,
        openedRecipient,
        priorityFee: {
          amount: priorityFee.amount.toString(),
          feerate: priorityFee.feerate || "none",
          source: priorityFee.source,
        },
      });

      setIsEstimating(true);
      const estimate = await walletStore.estimateSendMessageFees(
        message,
        new Address(openedRecipient),
        priorityFee
      );

      console.log("Fee estimate received:", estimate);
      setFeeEstimate(Number(estimate.fees) / 100_000_000);
      setIsEstimating(false);
    } catch (error) {
      console.error("Error estimating fee:", error);
      setIsEstimating(false);
      setFeeEstimate(null);
    }
  }, [walletStore, message, openedRecipient, priorityFee]);

  // Use effect to trigger fee estimation when message, recipient, or priority fee changes
  useEffect(() => {
    const delayEstimation = setTimeout(() => {
      if (openedRecipient && message) {
        console.log("Triggering fee estimation after delay");
        estimateFee();
      }
    }, 500);

    return () => clearTimeout(delayEstimation);
  }, [message, openedRecipient, priorityFee, estimateFee]);

  const sendMessage = useCallback(async () => {
    const recipient = openedRecipient;
    if (!walletStore.address) {
      toast.error("Unexpected error: No selected address.");
      return;
    }

    if (!walletStore.unlockedWallet) {
      toast.error("Wallet is locked. Please unlock your wallet first.");
      return;
    }

    if (!message) {
      toast.error("Please enter a message.");
      return;
    }

    if (recipient === null) {
      toast.error("Please enter a recipient address.");
      return;
    }

    try {
      console.log(
        "Sending transaction from primary address:",
        walletStore.address.toString()
      );

      // Check if we have an active conversation with this recipient
      const activeConversations = messageStore.getActiveConversations();
      const existingConversation = activeConversations.find(
        (conv) => conv.kaspaAddress === openedRecipient
      );

      let messageToSend = message;
      let fileDataForStorage:
        | {
            type: string;
            name: string;
            size: number;
            mimeType: string;
            content: string;
          }
        | undefined = undefined;

      // Check if this is a file message
      try {
        const parsedContent = JSON.parse(message);
        if (parsedContent.type === "file") {
          // Store the complete file data for local storage
          fileDataForStorage = {
            type: "file",
            name: parsedContent.name,
            size: parsedContent.size || 0,
            mimeType: parsedContent.mimeType,
            content: parsedContent.content,
          };

          // For the actual message, we only send the essential file info
          messageToSend = JSON.stringify({
            type: "file",
            name: parsedContent.name,
            mimeType: parsedContent.mimeType,
            content: parsedContent.content,
          });
        }
      } catch {
        // Not a file message, use message as is
      }

      let txId: string;

      // If we have an active conversation, use the context-aware sending
      if (existingConversation && existingConversation.theirAlias) {
        console.log("Sending message with conversation context:", {
          openedRecipient,
          theirAlias: existingConversation.theirAlias,
          priorityFee: priorityFee.amount.toString(),
        });

        if (!walletStore.accountService) {
          throw new Error("Account service not initialized");
        }

        // Use the account service directly for context-aware sending
        txId = await walletStore.accountService.sendMessageWithContext({
          toAddress: new Address(recipient),
          message: messageToSend,
          password: walletStore.unlockedWallet.password,
          theirAlias: existingConversation.theirAlias,
          priorityFee: priorityFee,
        });
      } else {
        // If no active conversation or no alias, use regular sending
        console.log(
          "No active conversation found, sending regular message with priority fee:",
          priorityFee.amount.toString()
        );
        txId = await walletStore.sendMessage({
          message: messageToSend,
          toAddress: new Address(recipient),
          password: walletStore.unlockedWallet.password,
          priorityFee,
        });
      }
      setIsExpanded(false);
      console.log("Message sent! Transaction response:", txId);

      // Create the message object for storage
      const newMessageData: Message = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipient,
        timestamp: Date.now(),
        content: fileDataForStorage
          ? JSON.stringify(fileDataForStorage)
          : message, // Store the complete file data in content
        amount: 20000000, // 0.2 KAS in sompi
        fee: feeEstimate || undefined, // Include the fee estimate if available
        payload: "", // No need to store encrypted payload for sent messages
        fileData: fileDataForStorage, // Also store it in fileData for immediate display
      };

      // Store message under both sender and recipient addresses for proper conversation grouping
      messageStore.storeMessage(newMessageData, walletStore.address.toString());
      messageStore.storeMessage(newMessageData, recipient);
      messageStore.addMessages([newMessageData]);

      // Only reset the message input, keep the recipient
      if (messageInputRef.current) messageInputRef.current.value = "";
      setMessage("");
      if (messageInputRef.current) {
        messageInputRef.current.style.height = "";
      }
      setFeeEstimate(null);

      // Keep the conversation open with the same recipient
      messageStore.setOpenedRecipient(recipient);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  }, [
    messageStore,
    walletStore,
    message,
    openedRecipient,
    feeEstimate,
    priorityFee,
  ]);

  const onSendClicked = useCallback(async () => {
    // Check if we have an active conversation with this recipient
    const activeConversations = messageStore.getActiveConversations();
    const existingConversation = activeConversations.find(
      (conv) => conv.kaspaAddress === openedRecipient
    );

    if (existingConversation) {
      return sendMessage();
    }

    // If no active conversation, display a warning modal
    openModal("warn-costy-send-message");
  }, [messageStore, openModal, openedRecipient, sendMessage]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const { fileMessage, error } = await prepareFileForUpload(
      file,
      MAX_PAYLOAD_SIZE,
      {},
      (status) => toast.info(status)
    );
    setIsUploading(false);

    if (error) {
      toast.error(error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (fileMessage) {
      setMessage(fileMessage);
      if (messageInputRef.current) {
        messageInputRef.current.value = `[File: ${file.name}]`;
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative flex-col gap-8">
      {/* Chevron expand/collapse that sorta sits above the textarea */}
      <div className="absolute -top-4 left-1/2 z-10 hidden -translate-x-1/2 sm:block">
        {!isExpanded ? (
          <button
            type="button"
            className="flex cursor-pointer items-center justify-center rounded-full p-1 transition-colors duration-150 hover:bg-white/10"
            onClick={() => {
              setIsExpanded(true);
              if (messageInputRef.current) {
                messageInputRef.current.style.height = "144px";
              }
              if (onExpand) onExpand();
            }}
          >
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          </button>
        ) : (
          <button
            type="button"
            className="flex cursor-pointer items-center justify-center rounded-full p-1 transition-colors duration-150 hover:bg-white/10"
            onClick={() => {
              setIsExpanded(false);
              if (messageInputRef.current) {
                messageInputRef.current.style.height = "auto";
                const t = messageInputRef.current;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 144)}px`;
              }
            }}
          >
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>
      {openedRecipient && message && (
        <div className="absolute -top-7.5 right-4 flex items-center gap-2">
          <div
            className={clsx(
              "inline-block rounded-md border bg-white/10 px-3 py-1 text-right text-xs text-gray-400 transition-opacity duration-300 ease-out",
              feeEstimate != null && getFeeClasses(feeEstimate)
            )}
          >
            {isEstimating
              ? feeEstimate != null
                ? `Updating fee… ${formatKasAmount(feeEstimate)} KAS`
                : `Estimating fee…`
              : feeEstimate != null
                ? `Estimated fee: ${formatKasAmount(feeEstimate)} KAS`
                : `Calculating fee…`}
          </div>

          <PriorityFeeSelector
            currentFee={priorityFee}
            onFeeChange={setPriorityFee}
            className="mr-0 sm:mr-2"
          />
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--primary-bg)] p-1">
        <Textarea
          ref={messageInputRef}
          rows={isExpanded ? 6 : 1}
          placeholder="Type your message..."
          className="peer flex-1 resize-none overflow-y-auto border-none bg-transparent p-2 text-[0.9em] text-[var(--text-primary)] outline-none"
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          onInput={(e) => {
            const t = e.currentTarget;
            if (!isExpanded) {
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 144)}px`;
            } else {
              t.style.height = "144px";
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendClicked();
            }
          }}
          autoComplete="off"
          spellCheck="false"
          data-form-type="other"
          style={isExpanded ? { height: "144px" } : {}}
        />

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileUpload}
          accept="image/*,.txt,.json,.md"
        />
        <Popover className="relative">
          {({ close }) => (
            <>
              <PopoverButton className="peer rounded p-2 hover:bg-white/5">
                <PlusIcon className="size-5" />
              </PopoverButton>
              <Transition
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel className="absolute right-0 bottom-full mb-2 flex flex-col gap-2 rounded bg-[var(--secondary-bg)] p-2 shadow-lg">
                  <button
                    onClick={() => {
                      openFileDialog();
                      close();
                    }}
                    className="flex items-center gap-2 rounded p-2 hover:bg-white/5"
                    disabled={isUploading}
                  >
                    <PaperClipIcon className="m-2 size-5" />
                  </button>

                  {openedRecipient && (
                    <SendPayment
                      address={openedRecipient}
                      onPaymentSent={close}
                    />
                  )}
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>

        <button
          onClick={onSendClicked}
          className={clsx(
            "text-kas-primary hover:text-kas-secondary transition-width flex items-center justify-center overflow-hidden duration-200 ease-out",
            message.length > 0 ? "mr-2 w-6 cursor-pointer" : "w-0"
          )}
          aria-label="Send"
        >
          <PaperAirplaneIcon className="h-6 w-6" />
        </button>
      </div>

      {isOpen("warn-costy-send-message") && (
        <Modal onClose={() => closeModal("warn-costy-send-message")}>
          <div className="flex flex-col items-center justify-center gap-8">
            <h2 className="text-lg text-yellow-400">
              <ExclamationTriangleIcon className="mr-2 inline size-6 text-yellow-400" />
              Your Correspondent hasn't answered yet
            </h2>

            <p className="text-center">
              Sending this message will carry an{" "}
              <span className="font-bold">extra cost of 0.2 KAS</span>, that
              will be sent to your correspondent. Are you sure you want to send
              it?
            </p>
            <div className="flex items-start justify-start rounded-lg border border-[#B6B6B6]/20 bg-gradient-to-br from-[#B6B6B6]/10 to-[#B6B6B6]/5 px-4 py-2">
              <InformationCircleIcon className="mr-2 size-10 text-white" />
              <p className="">
                This is occuring because your correspondent hasn't accepted the
                handshake yet.
              </p>
            </div>

            <Button
              onClick={() => {
                closeModal("warn-costy-send-message");
                sendMessage();
              }}
            >
              Send anyway
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
