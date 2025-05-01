import { FC, useState, useEffect } from "react";
import { Message as MessageType } from "../type/all";
import { decodePayload } from "../utils/all-in-one";
import { formatKasAmount } from "../utils/format";
import { decrypt_message } from "cipher";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";

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
    transactionId,
  } = message;
  const displayAddress = isOutgoing ? recipientAddress : senderAddress;
  const walletStore = useWalletStore();

  const shortDisplayAddress =
    displayAddress && displayAddress !== "Unknown"
      ? `${displayAddress.substring(0, 12)}...${displayAddress.substring(
          displayAddress.length - 12
        )}`
      : "Unknown";

  const [decryptedContent, setDecryptedContent] = useState<string>("");

  useEffect(() => {
    const decryptMessage = async () => {
      if (!payload || !walletStore.unlockedWallet) return;

      try {
        // Check if the payload starts with the cipher prefix
        const prefix = "ciph_msg:"
          .split("")
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("");
        
        if (payload.startsWith(prefix)) {
          // Extract the encrypted message hex
          const encryptedHex = payload.substring(prefix.length);
          
          // Get the private key generator
          const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
            walletStore.unlockedWallet,
            walletStore.unlockedWallet.password
          );
          
          // Get the private key for decryption
          const privateKey = privateKeyGenerator.receiveKey(0);
          
          // Create EncryptedMessage from hex
          const encryptedMessage = new (window as any).EncryptedMessage(encryptedHex);
          
          // Decrypt the message
          const decrypted = await decrypt_message(encryptedMessage, privateKey);
          
          setDecryptedContent(decrypted || "");
        } else {
          // If not encrypted, use the regular decodePayload
          const decoded = decodePayload(payload);
          setDecryptedContent(decoded || "");
        }
      } catch (error) {
        console.error("Error decrypting message:", error);
        const decoded = decodePayload(payload);
        setDecryptedContent(decoded || "");
      }
    };

    decryptMessage();
  }, [payload, walletStore.unlockedWallet]);

  return (
    <div className={`message ${isOutgoing ? "outgoing" : "incoming"}`}>
      <div className="message-header">
        <span className="message-from">
          {isOutgoing ? "To" : "From"}: {shortDisplayAddress}
        </span>
        <span className="message-time">
          {timestamp ? new Date(timestamp).toLocaleString() : "Pending"}
        </span>
      </div>
      <div className="message-content">{decryptedContent || content}</div>
      <div className="message-footer">
        <span className="message-id">
          <span className="tx-label">TX: </span>
          <span className="tx-value">{transactionId || "Pending..."}</span>
        </span>
        {amount && (
          <span className="message-amount">{formatKasAmount(amount)} KAS</span>
        )}
      </div>
    </div>
  );
};
