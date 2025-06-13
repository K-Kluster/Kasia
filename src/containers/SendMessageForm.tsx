import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { Message } from "../type/all";
import { amountFromMessage } from "../utils/amount-from-message";
import { unknownErrorToErrorLike } from "../utils/errors";
import { Input } from "@headlessui/react";
import { useWalletStore } from "../store/wallet.store";
import { Address } from "kaspa-wasm";
import { formatKasAmount } from "../utils/format";
import { encrypt_message } from "cipher";

type SendMessageFormProps = unknown;

export const SendMessageForm: FC<SendMessageFormProps> = () => {
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const walletStore = useWalletStore();
  const isCreatingNewChat = useMessagingStore((s) => s.isCreatingNewChat);
  const [feeEstimate, setFeeEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const messageStore = useMessagingStore();

  const recipientInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("Opened recipient:", openedRecipient);

    if (openedRecipient && recipientInputRef.current) {
      recipientInputRef.current.value = openedRecipient;
      setRecipient(openedRecipient);
      messageInputRef.current?.focus();
    }
  }, [openedRecipient]);

  useEffect(() => {
    if (isCreatingNewChat && recipientInputRef.current && messageInputRef.current) {
      recipientInputRef.current.value = "";
      messageInputRef.current.value = "";
      setRecipient("");
      setMessage("");
      recipientInputRef.current.focus();
    }
  }, [isCreatingNewChat]);

  const estimateFee = useCallback(async () => {
    if (!walletStore.unlockedWallet) {
      console.log("Cannot estimate fee: missing wallet");
      return;
    }

    if (!message || !recipient) {
      console.log("Cannot estimate fee: missing message or recipient");
      return;
    }

    try {
      console.log("Estimating fee for message:", { 
        length: message.length, 
        recipient 
      });
      
      setIsEstimating(true);
      setIsUsingFallback(false);
      const estimate = await walletStore.estimateMessageFee(
        message,
        new Address(recipient),
        walletStore.unlockedWallet.password
      );
      
      console.log("Fee estimate received:", estimate);
      setFeeEstimate(estimate.fees);
      setIsEstimating(false);
      
      // Check if we got a fallback estimate (always has exactly 1 transaction and 1 utxo)
      if (estimate.transactions === 1 && estimate.utxos === 1) {
        setIsUsingFallback(true);
      }
    } catch (error) {
      console.error("Error estimating fee:", error);
      setIsEstimating(false);
      setFeeEstimate(null);
    }
  }, [walletStore, message, recipient]);

  // Use effect to trigger fee estimation when message or recipient changes
  useEffect(() => {
    const delayEstimation = setTimeout(() => {
      if (recipient && message) {
        console.log("Triggering fee estimation after delay");
        estimateFee();
      }
    }, 500);

    return () => clearTimeout(delayEstimation);
  }, [message, recipient, estimateFee]);

  const onSendClicked = useCallback(async () => {
    if (!walletStore.address) {
      alert("Shouldn't occurs, no selected address");
      return;
    }

    if (!walletStore.unlockedWallet) {
      alert("Shouldn't occurs, no unlocked wallet");
      return;
    }

    if (!message) {
      alert("Please enter a message");
      return;
    }
    if (!recipient) {
      alert("Please enter a recipient address");
      return;
    }

    try {
      console.log("Sending transaction from primary address:", walletStore.address.toString());

      // Check if we have an active conversation with this recipient
      const activeConversations = messageStore.getActiveConversations();
      const existingConversation = activeConversations.find(conv => conv.kaspaAddress === recipient);

      let messageToSend = message;
      let fileDataForStorage: { type: string; name: string; size: number; mimeType: string; content: string; } | undefined = undefined;

      // Check if this is a file message
      try {
        const parsedContent = JSON.parse(message);
        if (parsedContent.type === 'file') {
          // Store the complete file data for local storage
          fileDataForStorage = {
            type: 'file',
            name: parsedContent.name,
            size: parsedContent.size || 0,
            mimeType: parsedContent.mimeType,
            content: parsedContent.content
          };
          
          // For the actual message, we only send the essential file info
          messageToSend = JSON.stringify({
            type: 'file',
            name: parsedContent.name,
            mimeType: parsedContent.mimeType,
            content: parsedContent.content
          });
        }
      } catch (e) {
        // Not a file message, use message as is
      }

      let txId: string;
      
      // If we have an active conversation, use the context-aware sending
      if (existingConversation && existingConversation.theirAlias) {
        console.log("Sending message with conversation context:", {
          recipient,
          theirAlias: existingConversation.theirAlias
        });
        
        if (!walletStore.accountService) {
          throw new Error("Account service not initialized");
        }
        
        // Use the account service directly for context-aware sending
        txId = await walletStore.accountService.sendMessageWithContext({
          toAddress: new Address(recipient),
          message: messageToSend,
          password: walletStore.unlockedWallet.password,
          theirAlias: existingConversation.theirAlias
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
        content: fileDataForStorage ? JSON.stringify(fileDataForStorage) : message, // Store the complete file data in content
        amount: 20000000, // 0.2 KAS in sompi
        fee: feeEstimate || undefined,  // Include the fee estimate if available
        payload: "",  // No need to store encrypted payload for sent messages
        fileData: fileDataForStorage  // Also store it in fileData for immediate display
      };

      // Store message under both sender and recipient addresses for proper conversation grouping
      messageStore.storeMessage(newMessageData, walletStore.address.toString());
      messageStore.storeMessage(newMessageData, recipient);
      messageStore.addMessages([newMessageData]);

      // Only reset the message input, keep the recipient
      if (messageInputRef.current) messageInputRef.current.value = "";
      setMessage("");
      setFeeEstimate(null);

      // Keep the conversation open with the same recipient
      messageStore.setOpenedRecipient(recipient);
      messageStore.setIsCreatingNewChat(false);
    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  }, [messageStore, walletStore, message, recipient, feeEstimate]);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Kaspa transaction payload size needs to be limited to ensure it fits in a transaction
    // Base64 encoding increases size by ~33%, so we need to account for that
    // Also need to leave room for other transaction data
    const maxSize = 10 * 1024; // 10KB max for any file type to ensure it fits in transaction payload
    if (file.size > maxSize) {
      alert(`File too large. Please keep files under ${maxSize / 1024}KB to ensure it fits in a Kaspa transaction.`);
      return;
    }

    setIsUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Content = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('Failed to read file as base64'));
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
        content: base64Content
      });

      // Verify the total message size will fit in a transaction
      if (fileMessage.length > maxSize) {
        throw new Error(`Encoded file data too large for a Kaspa transaction. Please use a smaller file.`);
      }

      // Set the message content
      setMessage(fileMessage);
      if (messageInputRef.current) {
        messageInputRef.current.value = `[File: ${file.name}]`;
      }
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Failed to read file: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="message-input-container">
      <Input
        ref={recipientInputRef}
        type="text"
        id="recipientAddress"
        placeholder="Recipient address"
        className="recipient-input"
        value={recipient}
        onChange={(e) => {
          const value = e.target.value;
          setRecipient(value);
          setFeeEstimate(null);
          setIsUsingFallback(false);
        }}
      />
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
            setFeeEstimate(null);
            setIsUsingFallback(false);
          }}
          autoComplete="off"
          spellCheck="false"
          data-form-type="other"
        />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept="image/*,.txt,.json,.md"
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="file-upload-button"
          title="Upload file (images up to 100KB, other files up to 10KB)"
          disabled={isUploading}
        >
          📎
        </button>
        <button onClick={onSendClicked} id="sendButton" className="send-button">
          Send
        </button>
      </div>
      {isEstimating && <div className="fee-estimate">Estimating fee...</div>}
      {!isEstimating && feeEstimate !== null && (
        <div className={`fee-estimate ${isUsingFallback ? 'fee-estimate-fallback' : ''}`}>
          {isUsingFallback 
            ? `Estimated fee (approximate): ~${formatKasAmount(feeEstimate)} KAS`
            : `Estimated fee: ${formatKasAmount(feeEstimate)} KAS`}
        </div>
      )}
    </div>
  );
};
