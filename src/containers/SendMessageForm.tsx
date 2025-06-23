import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { Message } from "../types/all";
import { unknownErrorToErrorLike } from "../utils/errors";
import { Input } from "@headlessui/react";
import { useWalletStore } from "../store/wallet.store";
import { Address, kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { formatKasAmount } from "../utils/format";
import { createWithdrawTransaction } from "../service/account-service";
import clsx from "clsx";
import { PaperClipIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

// Backwards K icon component for Kaspa
const BackwardsKIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 4v16h2v-6.5l1.5-1.5L16 18h2.5l-5-7 4.5-7H15.5L12 8.5V4H8z"
      transform="scale(-1,1) translate(-24,0)"
    />
  </svg>
);
import { toast } from "../utils/toast";

type SendMessageFormProps = unknown;

export const SendMessageForm: FC<SendMessageFormProps> = () => {
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const walletStore = useWalletStore();
  const [feeEstimate, setFeeEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Pay functionality state
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const messageStore = useMessagingStore();
  const balance = useWalletStore((s) => s.balance);

  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Reset pay form when recipient changes
  useEffect(() => {
    setShowPayForm(false);
    setPayAmount("");
    setPaymentError(null);
  }, [openedRecipient]);

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

  // Payment handling functions
  const handlePayClick = useCallback(() => {
    if (!openedRecipient) {
      alert("Please select a recipient first");
      return;
    }
    setShowPayForm(true);
    setPaymentError(null);
  }, [openedRecipient]);

  const handlePayAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setPayAmount(value);
      setPaymentError(null);
    }
  }, []);

  const handleMaxPayClick = useCallback(() => {
    if (balance?.mature) {
      const maxAmount = sompiToKaspaString(balance.mature);
      setPayAmount(maxAmount);
      setPaymentError(null);
    }
  }, [balance]);

  const handleSendPayment = useCallback(async () => {
    if (!openedRecipient) {
      setPaymentError("Please select a recipient first");
      return;
    }

    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPaymentError("Please enter a valid amount");
      return;
    }

    const amountSompi = kaspaToSompi(payAmount);
    if (!amountSompi) {
      setPaymentError("Invalid amount format");
      return;
    }

    // Check minimum amount (0.19 KAS dust limit)
    const minAmount = kaspaToSompi("0.19");
    if (amountSompi < minAmount!) {
      setPaymentError("Amount must be greater than 0.19 KAS");
      return;
    }

    // Check balance
    if (!balance?.mature || balance.mature < amountSompi) {
      setPaymentError(
        `Insufficient balance. Available: ${balance?.matureDisplay || "0"} KAS`
      );
      return;
    }

    try {
      setIsSendingPayment(true);
      setPaymentError(null);

      // Send the payment using withdraw transaction to the recipient
      // This is a simple transfer without any messages or conversation history
      await createWithdrawTransaction(openedRecipient, amountSompi);

      // Reset forms on success
      setPayAmount("");
      setShowPayForm(false);

      // Show success feedback (optional - you can remove this if you don't want any feedback)
      console.log(
        `Payment of ${payAmount} KAS sent successfully to ${openedRecipient}`
      );
    } catch (error) {
      console.error("Error sending payment:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Failed to send payment"
      );
    } finally {
      setIsSendingPayment(false);
    }
  }, [openedRecipient, payAmount, balance]);

  const handleCancelPay = useCallback(() => {
    setShowPayForm(false);
    setPayAmount("");
    setPaymentError(null);
  }, []);

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
    if (!openedRecipient) {
      toast.error("Please enter a recipient address.");
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
          toAddress: new Address(openedRecipient),
          message: messageToSend,
          password: walletStore.unlockedWallet.password,
          theirAlias: existingConversation.theirAlias,
        });
      } else {
        // If no active conversation or no alias, use regular sending
        console.log("No active conversation found, sending regular message");
        txId = await walletStore.sendMessage(
          messageToSend,
          new Address(openedRecipient),
          walletStore.unlockedWallet.password
        );
      }

      console.log("Message sent! Transaction response:", txId);

      // Create the message object for storage
      const newMessageData: Message = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: openedRecipient,
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
      messageStore.storeMessage(newMessageData, openedRecipient);
      messageStore.addMessages([newMessageData]);

      // Only reset the message input, keep the recipient
      if (messageInputRef.current) messageInputRef.current.value = "";
      setMessage("");
      setFeeEstimate(null);

      // Keep the conversation open with the same recipient
      messageStore.setOpenedRecipient(openedRecipient);
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

  useEffect(() => {
    const messageInput = messageInputRef.current;
    if (messageInput) {
      messageInput.addEventListener("keypress", onMessageInputKeyPressed);
    }

    return () => {
      if (messageInput) {
        messageInput.removeEventListener("keypress", onMessageInputKeyPressed);
      }
    };
  }, [messageInputRef, onMessageInputKeyPressed]);

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
    <div className="message-input-container cursor-text">
      <div className="message-input-wrapper">
        <Input
          ref={messageInputRef}
          type="text"
          id="messageInput"
          placeholder="Type your message..."
          className="message-input"
          value={message}
          onChange={(e) => {
            const value = e.target.value;
            setMessage(value);
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-5 h-5 m-1 flex items-center justify-center cursor-pointer text-gray-300 hover:text-gray-200"
          title="Upload file (images up to 100KB, other files up to 10KB)"
          disabled={isUploading}
        >
          <PaperClipIcon className="w-full h-full" />
        </button>
        <button
          onClick={handlePayClick}
          className={clsx(
            "px-3 py-2 rounded-lg cursor-pointer font-medium transition-all duration-200 flex items-center h-9",
            "text-white focus:outline-none focus:ring-2 focus:ring-[#70C7BA]",
            {
              "opacity-50 cursor-not-allowed": !openedRecipient || showPayForm,
              "bg-[#70C7BA] hover:bg-[#5fb5a3]": !(
                !openedRecipient || showPayForm
              ),
            }
          )}
          disabled={!openedRecipient || showPayForm}
          title="Send Kaspa payment to recipient"
        >
          <BackwardsKIcon className="w-4 h-4" />
          Pay
        </button>
        <button
          onClick={onSendClicked}
          className="w-6 h-6 bg-transparent m-1 flex items-center justify-center cursor-pointer text-kas-primary hover:text-kas-secondary"
        >
          <PaperAirplaneIcon className="w-full h-full" />
        </button>
      </div>

      {/* Pay form */}
      {showPayForm && (
        <div className="mt-3 p-4 bg-[var(--secondary-bg)] border border-[var(--border-color)] rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">
              Send Payment
            </h4>
            <button
              onClick={handleCancelPay}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
            >
              Cancel
            </button>
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <div className="relative">
                <Input
                  type="text"
                  value={payAmount}
                  onChange={(e) => handlePayAmountChange(e.target.value)}
                  placeholder="Amount (KAS)"
                  className="w-full px-3 py-2 pr-12 bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#70C7BA] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleMaxPayClick}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#70C7BA] hover:text-[#5fb5a3] font-medium text-xs"
                >
                  Max
                </button>
              </div>
              {balance?.matureDisplay && (
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Available: {balance.matureDisplay} KAS
                </div>
              )}
            </div>

            <button
              onClick={handleSendPayment}
              disabled={isSendingPayment || !payAmount}
              className={clsx(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 h-10",
                "bg-[#70C7BA] text-white hover:bg-[#5fb5a3] focus:outline-none focus:ring-2 focus:ring-[#70C7BA]",
                {
                  "opacity-50 cursor-not-allowed":
                    isSendingPayment || !payAmount,
                }
              )}
            >
              {isSendingPayment ? "Sending..." : "Send KAS"}
            </button>
          </div>

          {paymentError && (
            <div className="mt-2 text-sm text-red-500">{paymentError}</div>
          )}
        </div>
      )}

      {/* Enhanced fee estimate - no more flashing */}
      {openedRecipient && message && (
        <div className="fee-estimate">
          {isEstimating ? (
            <span>
              {feeEstimate !== null ? (
                <>Updating fee estimate... {formatKasAmount(feeEstimate)} KAS</>
              ) : (
                <>Estimating fee...</>
              )}
            </span>
          ) : feeEstimate !== null ? (
            <span>Estimated fee: {formatKasAmount(feeEstimate)} KAS</span>
          ) : (
            <span>Calculating fee...</span>
          )}
        </div>
      )}
    </div>
  );
};
