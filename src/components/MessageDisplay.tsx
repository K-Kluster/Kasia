import { FC, useState, useEffect, useRef } from "react";
import { Message as MessageType } from "../type/all";
import { decodePayload } from "../utils/all-in-one";
import { formatKasAmount } from "../utils/format";
import { decrypt_message, decrypt_message_with_bytes, decrypt_with_secret_key } from "cipher";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";
import { CipherHelper } from "../utils/cipher-helper";
import { useMessagingStore } from '../store/messaging.store';
import { HandshakeResponse } from './HandshakeResponse';

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
    amount,
    fee,
    transactionId,
    fileData
  } = message;
  
  const displayAddress = isOutgoing ? recipientAddress : senderAddress;
  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();
  const mounted = useRef(true);

  // Check if this is a handshake message
  const isHandshake = (payload?.startsWith('ciph_msg:') && 
                      payload?.includes(':handshake:')) ||
                     (content?.startsWith('ciph_msg:') && 
                      content?.includes(':handshake:'));

  // Get conversation if it's a handshake
  const conversation = isHandshake ? (() => {
    try {
      // Parse the handshake payload using the same method as ConversationManager
      const handshakeMessage = payload?.startsWith('ciph_msg:') ? payload : content;
      const parts = handshakeMessage.split(':');
      if (parts.length < 4 || parts[0] !== 'ciph_msg' || parts[2] !== 'handshake') {
        console.error('Invalid handshake payload format');
        return null;
      }

      const jsonPart = parts.slice(3).join(':'); // Handle colons in JSON
      const handshakePayload = JSON.parse(jsonPart);
      
      // Get all conversations
      const conversations = [
        ...(messagingStore.conversationManager?.getActiveConversations() || []),
        ...(messagingStore.conversationManager?.getPendingConversations() || [])
      ];

      // First try to find by conversation ID
      let foundConversation = conversations.find(c => c.conversationId === handshakePayload.conversationId);
      
      // If not found by ID, try to find by address
      if (!foundConversation) {
        foundConversation = conversations.find(c => 
          c.kaspaAddress === senderAddress || c.kaspaAddress === recipientAddress
        );
      }

      console.log('Found conversation:', foundConversation);
      return foundConversation;
    } catch (error) {
      console.error('Error parsing handshake payload:', error);
      return null;
    }
  })() : null;

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
    return null;  // Don't show amount for any messages
  };

  // Parse and render message content
  const renderMessageContent = () => {
    // If this is a handshake message and we found the conversation
    if (isHandshake && conversation) {
      // Only show handshake response UI if:
      // 1. The conversation is pending
      // 2. We didn't initiate it
      // 3. It hasn't been responded to yet
      if (conversation.status === 'pending' && !conversation.initiatedByMe) {
      console.log('Rendering handshake response for conversation:', conversation);
      return <HandshakeResponse conversation={conversation} />;
      }
      // For other handshake messages, just show the status text
      return conversation.status === 'active' 
        ? 'Handshake completed' 
        : conversation.initiatedByMe 
          ? 'Handshake sent' 
          : 'Handshake received';
    }

    // Wait for decryption attempt before showing content
    if (isDecrypting) {
      return <div className="decrypting">Decrypting message...</div>;
    }

    // Only use decrypted content if decryption was attempted and successful
    let messageToRender = (decryptionAttempted && decryptedContent) || content;
    
    // Handle file/image messages
    if (fileData && fileData.type === 'file') {
      if (fileData.mimeType.startsWith('image/')) {
        return <img src={fileData.content} alt={fileData.name} className="message-image" />;
      }
      return (
        <div className="file-message">
          <div className="file-info">
            📎 {fileData.name} ({Math.round(fileData.size / 1024)}KB)
          </div>
          <button 
            className="download-button"
            onClick={() => {
              const link = document.createElement('a');
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

    // Try to parse as JSON in case it's a file message in content
    try {
      const parsedContent = JSON.parse(messageToRender);
      if (parsedContent.type === 'file') {
        if (parsedContent.mimeType.startsWith('image/')) {
          return <img key={`img-${transactionId}`} src={parsedContent.content} alt={parsedContent.name} className="message-image" />;
        }
        return (
          <div key={`file-${transactionId}`} className="file-message">
            <div className="file-info">
              📎 {parsedContent.name} ({Math.round((parsedContent.size || 0) / 1024)}KB)
            </div>
            <button 
              className="download-button"
              onClick={() => {
                const link = document.createElement('a');
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
      // Not a JSON message, render as text
    }

    return messageToRender;
  };

  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [decryptionError, setDecryptionError] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptionAttempted, setDecryptionAttempted] = useState<boolean>(false);

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
        await new Promise(resolve => setTimeout(resolve, 100));

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
              throw new Error("Failed to decrypt with both receive and change keys");
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
          setDecryptionError(error instanceof Error ? error.message : "Unknown error");
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