import { FC, useState, useEffect, useRef } from "react";
import { Message as MessageType } from "../types/all";
import { decodePayload } from "../utils/all-in-one";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";
import { CipherHelper } from "../utils/cipher-helper";
import { useMessagingStore } from "../store/messaging.store";
import { HandshakeResponse } from "./HandshakeResponse";
import { KasIcon } from "./icons/KasCoin";
import { useFeatureStore } from "../store/feature.store";

type MessageDisplayProps = {
  message: MessageType;
  isOutgoing: boolean;
};

export const MessageDisplay: FC<MessageDisplayProps> = ({
  message,
  isOutgoing,
}) => {
  const {
    senderAddress,
    recipientAddress,
    timestamp,
    payload,
    content,
    fee,
    transactionId,
    fileData,
  } = message;

  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();
  const featureStore = useFeatureStore();
  const mounted = useRef(true);

  // Check if this is a handshake message
  const isHandshake =
    (payload?.startsWith("ciph_msg:") && payload?.includes(":handshake:")) ||
    (content?.startsWith("ciph_msg:") && content?.includes(":handshake:"));

  // Check if this is a payment message by checking the hex payload OR decrypted content
  const isPayment = (() => {
    // First check if it's a hex payload starting with ciph_msg prefix
    if (payload) {
      const prefix = "636970685f6d73673a"; // hex for "ciph_msg:"
      if (payload.startsWith(prefix)) {
        // Extract the message part and check for payment prefix
        const messageHex = payload.substring(prefix.length);
        const paymentPrefix = "313a7061796d656e743a"; // "1:payment:" in hex
        if (messageHex.startsWith(paymentPrefix)) {
          return true;
        }
      }
    }

    // Also check if the content is already decrypted payment JSON
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === "payment") {
          return true;
        }
      } catch (e) {
        // Not JSON, continue checking
      }
    }

    return false;
  })();

  // Get conversation if it's a handshake
  const conversation = isHandshake
    ? (() => {
        try {
          // Parse the handshake payload using the same method as ConversationManager
          const handshakeMessage = payload?.startsWith("ciph_msg:")
            ? payload
            : content;
          const parts = handshakeMessage.split(":");
          if (
            parts.length < 4 ||
            parts[0] !== "ciph_msg" ||
            parts[2] !== "handshake"
          ) {
            console.error("Invalid handshake payload format");
            return null;
          }

          const jsonPart = parts.slice(3).join(":"); // Handle colons in JSON
          const handshakePayload = JSON.parse(jsonPart);

          // Get all conversations
          const conversations = [
            ...(messagingStore.conversationManager?.getActiveConversations() ||
              []),
            ...(messagingStore.conversationManager?.getPendingConversations() ||
              []),
          ];

          // First try to find by conversation ID
          let foundConversation = conversations.find(
            (c) => c.conversationId === handshakePayload.conversationId
          );

          // If not found by ID, try to find by address
          if (!foundConversation) {
            foundConversation = conversations.find(
              (c) =>
                c.kaspaAddress === senderAddress ||
                c.kaspaAddress === recipientAddress
            );
          }

          console.log("Found conversation:", foundConversation);
          return foundConversation;
        } catch (error) {
          console.error("Error parsing handshake payload:", error);
          return null;
        }
      })()
    : null;

  // Get the correct explorer URL based on network
  const getExplorerUrl = (txId: string) => {
    return walletStore.selectedNetwork === "mainnet"
      ? `https://explorer.kaspa.org/txs/${txId}`
      : `https://explorer-tn10.kaspa.org/txs/${txId}`;
  };

  // Format amount or fee for display
  const formatAmountAndFee = () => {
    if (isOutgoing && fee !== undefined) {
      return (
        <div className="message-transaction-info">
          <div className="message-fee">Fee: {fee.toFixed(8)} KAS</div>
        </div>
      );
    }
    return null; // Don't show amount for any messages
  };

  // Render payment message content
  const renderPaymentMessage = () => {
    if (isDecrypting) {
      return (
        <div className="px-3 py-2 bg-teal-50 rounded-md text-gray-600 italic text-xs">
          Decrypting payment message...
        </div>
      );
    }

    // For payment messages, we'll only show the UI elements, not the raw content
    const messageToRender = content;

    try {
      if (messageToRender) {
        const paymentPayload = JSON.parse(messageToRender);

        if (paymentPayload.type === "payment") {
          return (
            <div className="flex items-center gap-3 p-4">
              <div className="flex items-center justify-center min-w-20 h-20 mr-1 drop-shadow-[0_0_20px_rgba(112,199,186,0.7)] animate-pulse">
                <KasIcon
                  className="w-20 h-20 drop-shadow-[0_0_15px_rgba(112,199,186,0.8)]"
                  circleClassName="fill-white"
                  kClassName="fill-[#70C7BA]"
                />
              </div>
              <div className="flex-1">
                <div className="text-white font-medium text-sm mb-1 drop-shadow-sm">
                  {paymentPayload.message}
                </div>
                <div className="text-white/80 text-xs font-semibold drop-shadow-sm">
                  {isOutgoing ? "Sent" : "Received"} {paymentPayload.amount} KAS
                </div>
              </div>
            </div>
          );
        }
      }
    } catch (error) {
      console.warn("Could not parse payment message:", error);
      // If we can't parse it but we know it's a payment message,
      // show the raw content for debugging
      console.log("Raw payment content:", messageToRender);
    }

    // Fallback to showing basic payment info
    return (
      <div className="flex items-center gap-3 p-4">
        <div className="flex items-center justify-center min-w-10 h-10 mr-1 drop-shadow-[0_0_20px_rgba(112,199,186,0.7)]">
          <KasIcon
            className="w-10 h-10 drop-shadow-[0_0_15px_rgba(112,199,186,0.8)]"
            circleClassName="fill-white"
            kClassName="fill-[#70C7BA]"
          />
        </div>
        <div className="flex-1">
          <div className="text-white font-medium text-sm mb-1 drop-shadow-sm">
            Payment message
          </div>
          <div className="text-white/80 text-xs font-semibold drop-shadow-sm">
            {isOutgoing ? "Sent" : "Received"} payment
          </div>
        </div>
      </div>
    );
  };

  // Add GIF link detection and rendering
  const renderGifEmbed = (message: string) => {
    // Only render GIFs if feature is enabled
    if (!featureStore.isFeatureEnabled("gif")) {
      return message; // Return raw URL if feature disabled
    }

    // Handle direct Giphy media URLs
    if (message.match(/https?:\/\/media\d?\.giphy\.com\/.*\.gif/i)) {
      return (
        <div className="my-2">
          <img
            src={message}
            alt="GIF"
            className="w-full rounded-lg"
            loading="lazy"
          />
        </div>
      );
    }

    // Handle Tenor media URLs
    if (message.match(/https?:\/\/media\.tenor\.com\/.*\.gif/i)) {
      return (
        <div className="my-2">
          <img
            src={message}
            alt="GIF"
            className="w-full rounded-lg"
            loading="lazy"
          />
        </div>
      );
    }

    // Handle giphy.com website URLs
    const giphyWebsiteRegex =
      /https?:\/\/(?:www\.)?giphy\.com\/(?:gifs|embed)\/([a-zA-Z0-9]+)/i;
    const giphyMatch = message.match(giphyWebsiteRegex);

    if (giphyMatch) {
      const giphyId = giphyMatch[1];
      return (
        <>
          <div className="my-2 relative w-full pt-[56.25%]">
            <iframe
              src={`https://giphy.com/embed/${giphyId}`}
              className="absolute inset-0 w-full h-full rounded-lg"
              frameBorder="0"
              allowFullScreen
            />
          </div>
          <a
            href={`https://giphy.com/gifs/${giphyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-50 hover:opacity-100 transition-opacity"
          >
            via GIPHY
          </a>
        </>
      );
    }

    // Handle tenor.com website URLs
    const tenorWebsiteRegex =
      /https?:\/\/(?:www\.)?tenor\.com\/view\/([a-zA-Z0-9-]+)/i;
    const tenorMatch = message.match(tenorWebsiteRegex);

    if (tenorMatch) {
      return (
        <div className="my-2">
          <img
            src={message}
            alt="GIF"
            className="w-full rounded-lg"
            loading="lazy"
          />
        </div>
      );
    }

    return message;
  };

  // Modify renderMessageContent to use the new renderGifEmbed
  const renderMessageContent = () => {
    // If this is a handshake message and we found the conversation
    if (isHandshake && conversation) {
      // Only show handshake response UI if:
      // 1. The conversation is pending
      // 2. We didn't initiate it
      // 3. It hasn't been responded to yet
      if (conversation.status === "pending" && !conversation.initiatedByMe) {
        console.log(
          "Rendering handshake response for conversation:",
          conversation
        );
        return <HandshakeResponse conversation={conversation} />;
      }
      // For other handshake messages, just show the status text
      return conversation.status === "active"
        ? "Handshake completed"
        : conversation.initiatedByMe
        ? "Handshake sent"
        : "Handshake received";
    }

    // If this is a payment message, handle it specially
    if (isPayment) {
      return renderPaymentMessage();
    }

    // Wait for decryption attempt before showing content
    if (isDecrypting) {
      return (
        <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-600 italic text-xs">
          Decrypting message...
        </div>
      );
    }

    // Only use decrypted content if decryption was attempted and successful
    const messageToRender =
      (decryptionAttempted && decryptedContent) || content;

    // Handle file/image messages
    if (fileData && fileData.type === "file") {
      if (fileData.mimeType.startsWith("image/")) {
        return (
          <img
            src={fileData.content}
            alt={fileData.name}
            className="message-image"
          />
        );
      }
      return (
        <div className="file-message">
          <div className="file-info">
            📎 {fileData.name} ({Math.round(fileData.size / 1024)}
            KB)
          </div>
          <button
            className="download-button"
            onClick={() => {
              const link = document.createElement("a");
              link.href = fileData.content;
              link.download = fileData.name;
              link.click();
            }}
          >
            Download
          </button>
        </div>
      );
    }

    try {
      const parsedContent = JSON.parse(messageToRender);
      if (parsedContent.type === "file") {
        if (parsedContent.mimeType.startsWith("image/")) {
          return (
            <img
              key={`img-${transactionId}`}
              src={parsedContent.content}
              alt={parsedContent.name}
              className="message-image"
            />
          );
        }
        return (
          <div key={`file-${transactionId}`} className="file-message">
            <div className="file-info">
              📎 {parsedContent.name} (
              {Math.round((parsedContent.size || 0) / 1024)}KB)
            </div>
            <button
              className="download-button"
              onClick={() => {
                const link = document.createElement("a");
                link.href = parsedContent.content;
                link.download = parsedContent.name;
                link.click();
              }}
            >
              Download
            </button>
          </div>
        );
      }
    } catch (e) {
      // Not a JSON message, check for GIF links
      return renderGifEmbed(messageToRender);
    }

    return renderGifEmbed(messageToRender);
  };

  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [decryptionError, setDecryptionError] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptionAttempted, setDecryptionAttempted] =
    useState<boolean>(false);

  useEffect(() => {
    const decryptMessage = async () => {
      if (!mounted.current || !walletStore.unlockedWallet) {
        setDecryptionAttempted(true);
        return;
      }

      // If we already have decrypted content from the account service, use that
      if (content) {
        setDecryptedContent(content);
        setDecryptionError("");
        setDecryptionAttempted(true);
        return;
      }

      // Only attempt decryption if we don't have pre-decrypted content
      if (!payload) {
        setDecryptionAttempted(true);
        return;
      }

      setIsDecrypting(true);
      setDecryptionAttempted(false);

      try {
        // Add a small delay to ensure wallet is fully initialized
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!mounted.current) return;

        // Check if the payload starts with the cipher prefix
        const prefix = "ciph_msg:"
          .split("")
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("");

        if (payload.startsWith(prefix)) {
          // Extract the encrypted message hex
          const encryptedHex = CipherHelper.stripPrefix(payload);

          // Get the private key generator
          const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
            walletStore.unlockedWallet,
            walletStore.unlockedWallet.password
          );

          let decrypted: string | null = null;

          // Try decryption with receive key first
          try {
            const privateKey = privateKeyGenerator.receiveKey(0);
            decrypted = await CipherHelper.tryDecrypt(
              encryptedHex,
              privateKey.toString(),
              transactionId || `${senderAddress}-${timestamp}`
            );
          } catch (receiveErr) {
            // Try with change key as fallback
            try {
              const changeKey = privateKeyGenerator.changeKey(0);
              decrypted = await CipherHelper.tryDecrypt(
                encryptedHex,
                changeKey.toString(),
                transactionId || `${senderAddress}-${timestamp}`
              );
            } catch (changeErr) {
              throw new Error(
                "Failed to decrypt with both receive and change keys"
              );
            }
          }

          if (mounted.current && decrypted) {
            setDecryptedContent(decrypted);
            setDecryptionError("");
          }
        } else {
          const decoded = decodePayload(payload);
          if (mounted.current) {
            setDecryptedContent(decoded || "");
            setDecryptionError("");
          }
        }
      } catch (error) {
        console.error("Error decrypting message:", error);
        if (mounted.current) {
          setDecryptionError(
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      } finally {
        if (mounted.current) {
          setIsDecrypting(false);
          setDecryptionAttempted(true);
        }
      }
    };

    decryptMessage();
  }, [payload, walletStore.unlockedWallet, content]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <div className={`message ${isOutgoing ? "outgoing" : "incoming"}`}>
      <div className="message-header">
        <div className="message-timestamp">
          {new Date(timestamp).toLocaleString()}
        </div>
      </div>
      <div className="message-content">{renderMessageContent()}</div>
      <div className="message-footer">
        {formatAmountAndFee()}
        {transactionId && (
          <a
            href={getExplorerUrl(transactionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="transaction-link"
          >
            View Transaction
          </a>
        )}
      </div>
    </div>
  );
};
