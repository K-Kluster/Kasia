import { FC, useState, useEffect, useRef } from "react";
import { Message as MessageType } from "../../types/all";
import { decodePayload } from "../../utils/format";
import { useWalletStore } from "../../store/wallet.store";
import { WalletStorageService } from "../../service/wallet-storage-service";
import { CipherHelper } from "../../utils/cipher-helper";
import { useMessagingStore } from "../../store/messaging.store";
import clsx from "clsx";
import { PROTOCOL, DELIM } from "../../config/protocol";
import {
  ExplorerLink,
  generateBubbleClasses,
  MessageContentGenerator,
  detectMessageType,
  MessageTimestamp,
  MessageMeta,
} from "./Bubble";

type MessageDisplayProps = {
  message: MessageType;
  isOutgoing: boolean;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
};

export const MessageDisplay: FC<MessageDisplayProps> = ({
  message,
  isOutgoing,
  showTimestamp,
  groupPosition = "single",
}) => {
  const [showMeta, setShowMeta] = useState(false);

  const {
    senderAddress,
    recipientAddress,
    timestamp,
    payload,
    content,
    fee,
    transactionId,
  } = message;

  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();
  const mounted = useRef(true);

  const isRecent = Date.now() - timestamp < 12 * 60 * 60 * 1000; // if message is younger than 12 hours, its recent
  const date = new Date(timestamp);

  // if expanded OR stale, full date+time; otherwise just HH:MM
  const displayStamp =
    showMeta || !isRecent
      ? date.toLocaleString()
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Get conversation for handshake messages
  const conversation = (() => {
    try {
      // Check if this is a handshake message
      const isHandshake =
        (payload?.startsWith(PROTOCOL.prefix.string) &&
          payload?.includes(PROTOCOL.headers.HANDSHAKE.string)) ||
        (content?.startsWith(PROTOCOL.prefix.string) &&
          content?.includes(PROTOCOL.headers.HANDSHAKE.string));

      if (!isHandshake) return null;

      // Parse the handshake payload using the same method as ConversationManagerService
      const handshakeMessage = payload?.startsWith(PROTOCOL.prefix.string)
        ? payload
        : content;
      const parts = handshakeMessage.split(DELIM);
      if (
        parts.length < 4 ||
        parts[0] !== PROTOCOL.prefix.type ||
        parts[2] !== PROTOCOL.headers.HANDSHAKE.type
      ) {
        console.error("Invalid handshake payload format");
        return null;
      }

      const jsonPart = parts.slice(3).join(DELIM); // Handle delimiters in JSON
      const handshakePayload = JSON.parse(jsonPart);

      // Get all conversations
      const conversations = [
        ...(messagingStore.conversationManager?.getActiveConversations() || []),
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
  })();

  // Detect message type using utility
  const messageType = detectMessageType(message);
  const shouldUseBubble = !messageType.isImage;

  const [decryptedContent, setDecryptedContent] = useState<string>("");
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
        const prefix = PROTOCOL.prefix.hex;

        if (payload.startsWith(prefix)) {
          // Extract the encrypted message hex
          const encryptedHex = CipherHelper.stripPrefix(payload);

          // Get the private key generator
          const privateKeyGenerator =
            WalletStorageService.getPrivateKeyGenerator(
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
          } catch {
            // Try with change key as fallback
            try {
              const changeKey = privateKeyGenerator.changeKey(0);
              decrypted = await CipherHelper.tryDecrypt(
                encryptedHex,
                changeKey.toString(),
                transactionId || `${senderAddress}-${timestamp}`
              );
            } catch {
              throw new Error(
                "Failed to decrypt with both receive and change keys"
              );
            }
          }

          if (mounted.current && decrypted) {
            setDecryptedContent(decrypted);
          }
        } else {
          const decoded = decodePayload(payload);
          if (mounted.current) {
            setDecryptedContent(decoded || "");
          }
        }
      } catch (error) {
        console.error("Error decrypting message:", error);
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

  // Generate message content using the generator
  const renderMessageContent = () => (
    <MessageContentGenerator
      message={message}
      isOutgoing={isOutgoing}
      isDecrypting={isDecrypting}
      decryptionAttempted={decryptionAttempted}
      decryptedContent={decryptedContent}
      conversation={conversation || null}
    />
  );

  return (
    <div
      // what side of screen, left or right
      className={clsx(
        "flex w-full",
        isOutgoing
          ? "justify-end pr-0.5 sm:pr-2"
          : "justify-start pl-0.5 sm:pl-2"
      )}
    >
      {showMeta && transactionId && isOutgoing && (
        // when clicked, this is the tx explore button for outgoing messages
        <ExplorerLink
          transactionId={transactionId}
          network={walletStore.selectedNetwork}
          position="right"
        />
      )}

      {(() => {
        const timeStampBlock = (showMeta || showTimestamp) && (
          <MessageTimestamp
            timestamp={displayStamp}
            shouldUseBubble={shouldUseBubble}
          />
        );

        const metaBlock = showMeta && (
          <MessageMeta fee={fee} isOutgoing={isOutgoing} />
        );

        return shouldUseBubble ? (
          // Render with bubble styling
          <div
            onClick={() => setShowMeta((prev) => !prev)}
            className={generateBubbleClasses(isOutgoing, groupPosition)}
          >
            <div className="my-0.5 text-base leading-relaxed">
              {renderMessageContent()}
            </div>
            {timeStampBlock}
            {metaBlock}
          </div>
        ) : (
          // Render without bubble styling (for images)
          <div onClick={() => setShowMeta((prev) => !prev)}>
            {renderMessageContent()}
            {timeStampBlock}
            {metaBlock}
          </div>
        );
      })()}

      {showMeta && transactionId && !isOutgoing && (
        // when clicked, this is the tx explore button for incoming messages
        <ExplorerLink
          transactionId={transactionId}
          network={walletStore.selectedNetwork}
          position="left"
        />
      )}
    </div>
  );
};
