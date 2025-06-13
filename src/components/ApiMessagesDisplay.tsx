import { FC, useState, useEffect } from "react";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";
import { decrypt_message, EncryptedMessage } from "cipher";
import { formatKasAmount } from "../utils/format";
import { ConversationManager } from "../utils/conversation-manager";

type Transaction = {
  transaction_id: string;
  payload: string;
  block_time: number;
  outputs: Array<{
    amount: number;
    script_public_key_address: string;
  }>;
  inputs: Array<{
    previous_outpoint_address: string;
  }>;
};

type Message = {
    transactionId: string;
    senderAddress: string;
    recipientAddress: string;
    timestamp: number;
    content: string;
    amount: number;
    payload: string;
  conversationId?: string; // Added to track which conversation this belongs to
};

type ApiMessagesDisplayProps = {
  address: string;
  conversationManager: ConversationManager; // Added to access conversation info
};

export const ApiMessagesDisplay: FC<ApiMessagesDisplayProps> = ({ address, conversationManager }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletStore = useWalletStore();

  useEffect(() => {
    if (address && walletStore.unlockedWallet) {
      fetchMessages();
    }
  }, [address, walletStore.unlockedWallet]);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all addresses and aliases we need to monitor
      const monitoredConversations = conversationManager.getMonitoredConversations();
      const uniqueAddresses = new Set([
        address, // Always include our current address
        ...monitoredConversations.map(conv => conv.address)
      ]);

      // Fetch messages for all addresses
      const allMessages: Message[] = [];
      
      for (const addr of uniqueAddresses) {
        // Ensure the address is properly formatted for the API
        const formattedAddress = addr.includes(':') 
          ? encodeURIComponent(addr)
          : encodeURIComponent(`kaspatest:${addr}`);
      
      const apiUrl = `https://api-tn10.kaspa.org/addresses/${formattedAddress}/full-transactions-page?limit=50&before=0&after=0&resolve_previous_outpoints=no`;
      
      console.log("Fetching messages from API URL:", apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
          console.error(`Error fetching messages for address ${addr}: ${response.status} ${response.statusText}`);
          continue; // Skip this address but continue with others
      }
      
      const transactions: Transaction[] = await response.json();
        console.log(`Fetched ${transactions.length} transactions for address ${addr}`);
      
      // Process transactions and extract messages
      const processedMessages = await Promise.all(
        transactions
          .filter((tx: Transaction) => tx.payload && tx.payload.startsWith("636970685f6d73673a"))
          .map(async (tx: Transaction) => {
            console.log("Processing transaction with payload:", tx.payload);
            
            // For each transaction, determine if this is incoming or outgoing
            const recipientAddress = tx.outputs[0]?.script_public_key_address || "Unknown";
              const isOutgoing = recipientAddress !== addr;
            const senderAddress = isOutgoing ? 
                addr : 
              (tx.inputs[0]?.previous_outpoint_address || "Unknown");
              
            // Try to decrypt the message
            let decryptedContent = "";
            
            if (walletStore.unlockedWallet) {
              try {
                // Extract the encrypted part (remove the "ciph_msg:" prefix)
                const prefix = "636970685f6d73673a"; // hex for "ciph_msg:"
                const encryptedHex = tx.payload.substring(prefix.length);
                console.log("Attempting to decrypt hex:", encryptedHex);
                
                // Get the private key generator
                const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
                  walletStore.unlockedWallet,
                  walletStore.unlockedWallet.password
                );
                
                // Try multiple private keys
                const maxKeys = 5; // Try up to 5 keys for each type
                let decryptionSuccess = false;
                
                // First try with receive keys (standard addresses)
                for (let i = 0; i < maxKeys; i++) {
                  try {
                    console.log(`Trying receive key at index ${i}...`);
                    const privateKey = privateKeyGenerator.receiveKey(i);
                    const privateKeyHex = privateKey.toString();
                    console.log(`Got private key string: ${privateKeyHex.substring(0, 8)}...`);
                    
                    // Create EncryptedMessage and attempt to decrypt
                    const encryptedMessage = new EncryptedMessage(encryptedHex);
                    const result = await decrypt_message(encryptedMessage, privateKey);
                    
                    if (result) {
                      decryptedContent = result;
                      decryptionSuccess = true;
                      console.log(`Successfully decrypted with receive key at index ${i}`);
                      break;
                    }
                  } catch (e) {
                    console.log(`Failed to decrypt with receive key at index ${i}:`, e);
                  }
                }
                
                // If still not decrypted, try with change keys
                if (!decryptionSuccess) {
                  for (let i = 0; i < maxKeys; i++) {
                    try {
                      console.log(`Trying change key at index ${i}...`);
                      const privateKey = privateKeyGenerator.changeKey(i);
                      const privateKeyHex = privateKey.toString();
                      console.log(`Got private key string: ${privateKeyHex.substring(0, 8)}...`);
                      
                      // Create EncryptedMessage and attempt to decrypt
                      const encryptedMessage = new EncryptedMessage(encryptedHex);
                      const result = await decrypt_message(encryptedMessage, privateKey);
                      
                      if (result) {
                        decryptedContent = result;
                        decryptionSuccess = true;
                        console.log(`Successfully decrypted with change key at index ${i}`);
                        break;
                      }
                    } catch (e) {
                      console.log(`Failed to decrypt with change key at index ${i}:`, e);
                    }
                  }
                }
                
                if (!decryptionSuccess) {
                  decryptedContent = "[Could not decrypt message]";
                  console.log("Could not decrypt message with any key.");
                }
              } catch (error) {
                console.error("Error decrypting message:", error);
                decryptedContent = "[Decryption error]";
              }
            } else {
              decryptedContent = "[Wallet locked]";
            }
            
              // Create the message object
              const message: Message = {
              transactionId: tx.transaction_id,
              senderAddress,
              recipientAddress,
              timestamp: tx.block_time,
              content: decryptedContent,
              amount: tx.outputs[0]?.amount ? tx.outputs[0].amount / 100000000 : 0,
              payload: tx.payload
            };

              // Try to find which conversation this message belongs to
              if (decryptedContent !== "[Could not decrypt message]" && decryptedContent !== "[Decryption error]" && decryptedContent !== "[Wallet locked]") {
                // Check if the decrypted content contains any of our monitored aliases
                for (const conv of monitoredConversations) {
                  if (decryptedContent.includes(conv.alias)) {
                    // Find the conversation this alias belongs to
                    const conversation = conversationManager.getConversationByAlias(conv.alias);
                    if (conversation) {
                      message.conversationId = conversation.conversationId;
                      break;
                    }
                  }
                }
              }

              return message;
            })
        );
        
        allMessages.push(...processedMessages);
      }
      
      // Sort all messages by timestamp (newest first)
      allMessages.sort((a, b) => b.timestamp - a.timestamp);
      
      setMessages(allMessages);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(`Error fetching messages: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr === "Unknown") return "Unknown";
    return `${addr.substring(0, 12)}...${addr.substring(addr.length - 12)}`;
  };

  // Group messages by conversation
  const messagesByConversation = messages.reduce((acc, message) => {
    const convId = message.conversationId || 'unassigned';
    if (!acc[convId]) {
      acc[convId] = [];
    }
    acc[convId].push(message);
    return acc;
  }, {} as Record<string, Message[]>);

  return (
    <div className="api-messages-display">
      <div className="header">
        <h2>Messages from API</h2>
        <button onClick={fetchMessages} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="messages-list">
        {Object.entries(messagesByConversation).map(([convId, convMessages]) => {
          const conversation = convId !== 'unassigned' 
            ? conversationManager.getConversationByAlias(convMessages[0]?.content.split(' ')[0]) 
            : null;

          return (
            <div key={convId} className="conversation-group">
              {conversation && (
                <h3>Conversation with {conversation.theirAlias} ({shortenAddress(conversation.kaspaAddress)})</h3>
              )}
              {!conversation && convId === 'unassigned' && (
                <h3>Other Messages</h3>
              )}
              {convMessages.map((msg) => (
                <div key={msg.transactionId} className="message">
              <div className="message-header">
                    <span className="address">From: {shortenAddress(msg.senderAddress)}</span>
                    <span className="address">To: {shortenAddress(msg.recipientAddress)}</span>
                    <span className="timestamp">
                      {new Date(msg.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <div className="message-content">{msg.content}</div>
                  {msg.senderAddress === address && (
                    <div className="message-fee">
                      Fee: {formatKasAmount(msg.amount)} KAS
                    </div>
                )}
              </div>
              ))}
            </div>
          );
        })}
        {messages.length === 0 && !loading && (
          <div className="no-messages">No messages found</div>
        )}
      </div>
    </div>
  );
}; 