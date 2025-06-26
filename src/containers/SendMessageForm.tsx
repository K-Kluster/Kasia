import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { Message } from "../types/all";
import { unknownErrorToErrorLike } from "../utils/errors";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  Textarea
} from "@headlessui/react";
import { useWalletStore } from "../store/wallet.store";
import { Address } from "kaspa-wasm";
import { formatKasAmount } from "../utils/format";
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { toast } from "../utils/toast";
import { SendPayment } from "./SendPayment";
import clsx from "clsx";

type SendMessageFormProps = unknown;

// Arbritary fee levels to colour the fee indicator in chat
const FEE_LEVELS = [
  { limit: 0.00002000, classes: "text-green-400 border-green-400" },
  { limit: 0.00005000, classes: "text-blue-400  border-blue-400" },
  { limit: 0.0005, classes: "text-yellow-400 border-yellow-400" },
  { limit: 0.001, classes: "text-orange-400 border-orange-400" },
  { limit: Infinity, classes: "text-red-400 border-red-400" },
];

function getFeeClasses(fee: number) {
  return FEE_LEVELS.find(({ limit }) => fee <= limit)!.classes;
}

export const SendMessageForm: FC<SendMessageFormProps> = () => {
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const walletStore = useWalletStore();
  const [feeEstimate, setFeeEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const messageStore = useMessagingStore();

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = () => fileInputRef.current?.click();

  useEffect(() => {
    messageInputRef.current?.focus();
    setMessage("");
  }, [openedRecipient]);

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
      });

      setIsEstimating(true);
      const estimate = await walletStore.estimateSendMessageFees(
        message,
        new Address(openedRecipient)
      );

      console.log("Fee estimate received:", estimate);
      setFeeEstimate(Number(estimate.fees) / 100_000_000);
      setIsEstimating(false);
    } catch (error) {
      console.error("Error estimating fee:", error);
      setIsEstimating(false);
      setFeeEstimate(null);
    }
  }, [walletStore, message, openedRecipient]);

  // Use effect to trigger fee estimation when message or recipient changes
  useEffect(() => {
    const delayEstimation = setTimeout(() => {
      if (openedRecipient && message) {
        console.log("Triggering fee estimation after delay");
        estimateFee();
      }
    }, 500);

    return () => clearTimeout(delayEstimation);
  }, [message, openedRecipient, estimateFee]);

  const onSendClicked = useCallback(async () => {
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
      } catch (e) {
        // Not a file message, use message as is
      }

      let txId: string;

      // If we have an active conversation, use the context-aware sending
      if (existingConversation && existingConversation.theirAlias) {
        console.log("Sending message with conversation context:", {
          openedRecipient,
          theirAlias: existingConversation.theirAlias,
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
        });
      } else {
        // If no active conversation or no alias, use regular sending
        console.log("No active conversation found, sending regular message");
        txId = await walletStore.sendMessage(
          messageToSend,
          new Address(recipient),
          walletStore.unlockedWallet.password
        );
      }

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
  }, [messageStore, walletStore, message, openedRecipient, feeEstimate]);

  const onMessageInputKeyPressed = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        onSendClicked();
      }
    },
    [onSendClicked]
  );

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Kaspa transaction payload size needs to be limited to ensure it fits in a transaction
    // Base64 encoding increases size by ~33%, so we need to account for that
    // Also need to leave room for other transaction data
    const maxSize = 10 * 1024; // 10KB max for any file type to ensure it fits in transaction payload
    if (file.size > maxSize) {
      toast.error(
        `File too large. Please keep files under ${
          maxSize / 1024
        }KB to ensure it fits in a Kaspa transaction.`
      );
      return;
    }

    setIsUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Content = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === "string") {
            resolve(result);
          } else {
            reject(new Error("Failed to read file as base64"));
          }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      // Format the message with file metadata
      const fileMessage = JSON.stringify({
        type: "file",
        name: file.name,
        size: file.size,
        mimeType: file.type,
        content: base64Content,
      });

      // Verify the total message size will fit in a transaction
      if (fileMessage.length > maxSize) {
        throw new Error(
          `Encoded file data too large for a Kaspa transaction. Please use a smaller file.`
        );
      }

      // Set the message content
      setMessage(fileMessage);
      if (messageInputRef.current) {
        messageInputRef.current.value = `[File: ${file.name}]`;
      }
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error(
        "Failed to read file: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex-col gap-8 relative">
      {openedRecipient && message && (
        <div className="absolute right-0 -top-7.5">
          <div
            className={clsx(
              "inline-block bg-white/10 text-xs mr-5 py-1 px-3 rounded-md text-right border transition-opacity duration-300 ease-out text-gray-400",
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
        </div>
      )}
      <div className="flex items-center gap-2 bg-[var(--primary-bg)] rounded-lg p-1 border border-[var(--border-color)]">
        <Textarea
          ref={messageInputRef}
          rows={1}
          placeholder="Type your message..."
          className="resize-none overflow-y-auto bg-transparent border-none text-[var(--text-primary)] p-2 text-[0.9em] outline-none flex-1"
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 144)}px`;
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
              <PopoverButton className="p-2 hover:bg-white/5 rounded">
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
                <PopoverPanel className="absolute bottom-full mb-2 right-0 flex flex-col gap-2 bg-[var(--secondary-bg)] p-2 rounded shadow-lg">
                  <button
                    onClick={() => {
                      openFileDialog();
                      close();
                    }}
                    className="p-2 rounded hover:bg-white/5 flex items-center gap-2"
                    disabled={isUploading}
                  >
                    <PaperClipIcon className="size-5 m-2" />
                  </button>

                  {openedRecipient && <SendPayment address={openedRecipient} />}
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
        <button
          onClick={onSendClicked}
          className="w-6 h-6 bg-transparent m-1 flex items-center justify-center cursor-pointer text-kas-primary hover:text-kas-secondary"
        >
          <PaperAirplaneIcon className="w-full h-full" />
        </button>
      </div>
    </div>
  );
};
