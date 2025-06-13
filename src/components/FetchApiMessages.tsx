import { FC, useState, useEffect } from "react";
import { useWalletStore } from "../store/wallet.store";
import { useMessagingStore } from "../store/messaging.store";
import { WalletStorage } from "../utils/wallet-storage";
import { decrypt_message, EncryptedMessage } from "cipher";
import { Transaction } from "../type/all";
import { getApiEndpoint } from "../config/nodes";
import "./FetchApiMessages.css";
import { CipherHelper } from "../utils/cipher-helper";
import { Message } from "../type/all";

type FetchApiMessagesProps = {
  address: string;
};

export const FetchApiMessages: FC<FetchApiMessagesProps> = ({ address }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();

  useEffect(() => {
    if (address && walletStore.unlockedWallet) {
      fetchAndProcessMessages();
    }
  }, [address, walletStore.unlockedWallet]);

  const fetchAndProcessMessages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the current network from the wallet store
      const networkId = walletStore.selectedNetwork;
      const baseUrl = getApiEndpoint(networkId);
      
      // Get all addresses and aliases we need to monitor
      const monitoredConversations = messagingStore.conversationManager?.getMonitoredConversations() || [];
      const uniqueAddresses = new Set([
        address, // Always include our current address
        ...monitoredConversations.map(conv => conv.address)
      ]);

      // Create a map of aliases to conversation IDs for quick lookup
      const aliasToConversation = new Map();
      monitoredConversations.forEach(conv => {
        aliasToConversation.set(conv.alias, conv.address);
      });
      
      // Load existing messages to avoid duplicates
      const existingMessages = messagingStore.loadMessages(address);
      const existingTxIds = new Set(
        existingMessages.map(msg => msg.transactionId)
      );

      // Fetch and process messages for each address
      for (const currentAddress of uniqueAddresses) {
        // Ensure the address is properly formatted for the API
        const formattedAddress = currentAddress.includes(':') 
          ? encodeURIComponent(currentAddress)
          : encodeURIComponent(`${networkId === 'mainnet' ? 'kaspa:' : 'kaspatest:'}${currentAddress}`);
        
        const apiUrl = `${baseUrl}/addresses/${formattedAddress}/full-transactions-page?limit=50&before=0&after=0&resolve_previous_outpoints=no`;
        
        console.log(`API Messages: Fetching from URL for address ${currentAddress}:`, apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          console.error(`API error for address ${currentAddress}: ${response.status} ${response.statusText}`);
          continue; // Skip this address but continue with others
        }
        
        const transactions: Transaction[] = await response.json();
        console.log(`API Messages: Fetched ${transactions.length} transactions for ${currentAddress}`);
      
      // Process only encrypted message transactions
      const messageTxs = transactions.filter(tx => 
        tx.payload && tx.payload.startsWith("636970685f6d73673a")
      );
      
        console.log(`API Messages: Found ${messageTxs.length} encrypted message transactions for ${currentAddress}`);
      
      // Process each transaction
      for (const tx of messageTxs) {
        // Skip if we already have this transaction
        if (existingTxIds.has(tx.transaction_id)) {
          console.log(`API Messages: Skipping existing transaction: ${tx.transaction_id}`);
          continue;
        }
        
        console.log(`API Messages: Processing new transaction: ${tx.transaction_id}`);
        
        // For each transaction, determine if this is incoming or outgoing
        const recipientAddress = tx.outputs[0]?.script_public_key_address || "Unknown";
          const isIncoming = recipientAddress === currentAddress;
        const senderAddress = isIncoming ? 
          (tx.inputs[0]?.previous_outpoint_address || "Unknown") : 
            currentAddress;
          
        // Try to decrypt the message
        let decryptedContent = "";
        
        if (walletStore.unlockedWallet) {
          try {
            // Extract the encrypted part (remove the "ciph_msg:" prefix)
            const prefix = "636970685f6d73673a"; // hex for "ciph_msg:"
              if (!tx.payload.startsWith(prefix)) {
                console.log(`API Messages: Invalid message format, missing prefix: ${tx.payload.substring(0, 20)}...`);
                continue;
              }

              console.log(`API Messages: Full payload: ${tx.payload}`);
              const messageHex = tx.payload.substring(prefix.length);
              console.log(`API Messages: Message hex after prefix: ${messageHex}`);

              // Parse the message parts using browser-compatible hex decoding
              const hexToString = (hex: string) => {
                const hexArray = hex.match(/.{1,2}/g) || [];
                return hexArray.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
              };

              // First convert the hex to string to get the metadata
              const messageStr = hexToString(messageHex);
              console.log(`API Messages: Decoded message string: ${messageStr}`);

              // Split on first three colons to get metadata
              const parts = messageStr.split(/:(.*)/s); // Split on first colon and keep the rest
              if (parts.length < 2) {
                console.log(`API Messages: Invalid message format, couldn't split parts: ${messageStr}`);
                continue;
              }

              const version = parts[0];
              const remaining = parts[1];
              const [type, aliasAndContent] = remaining.split(/:(.*)/s);
              const [alias, encryptedContent] = aliasAndContent.split(/:(.*)/s);

              console.log(`API Messages: Parsed message parts:`);
              console.log(`- Version: ${version}`);
              console.log(`- Type: ${type}`);
              console.log(`- Alias: ${alias}`);
              console.log(`- Encrypted content (first 40 chars): ${encryptedContent?.substring(0, 40)}...`);

              if (!encryptedContent) {
                console.log('API Messages: No encrypted content found');
                continue;
              }
            
            // Get the private key generator
            const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
              walletStore.unlockedWallet,
              walletStore.unlockedWallet.password
            );
            
            // Try multiple private keys
              const maxKeys = 20; // Try up to 20 keys for each type
            let decryptionSuccess = false;
              let successfulKeyType = '';
              let successfulKeyIndex = -1;
            
            // First try with receive keys (standard addresses)
              for (let i = 0; i < maxKeys && !decryptionSuccess; i++) {
              try {
                console.log(`API Messages: Trying receive key at index ${i}`);
                const privateKey = privateKeyGenerator.receiveKey(i);
                  const privateKeyHex = privateKey.toString();
                  console.log(`API Messages: Using receive key ${privateKeyHex.substring(0, 8)}...`);
                  
                  // Use CipherHelper for robust decryption
                  const messageId = `${tx.transaction_id}_receive_${i}`;
                  const result = await CipherHelper.tryDecrypt(encryptedContent, privateKeyHex, messageId);
                
                if (result) {
                  decryptedContent = result;
                  decryptionSuccess = true;
                    successfulKeyType = 'receive';
                    successfulKeyIndex = i;
                    console.log(`API Messages: Successfully decrypted with receive key at index ${i} (${privateKeyHex.substring(0, 8)}...)`);
                    
                    // Create and store the decrypted message
                    const message: Message = {
                      senderAddress: tx.outputs[0].script_public_key_address || "Unknown",
                      recipientAddress: walletStore.address?.toString() || "Unknown",
                      timestamp: tx.block_time || Date.now(),
                      content: decryptedContent,
                      payload: tx.payload,
                      amount: tx.outputs[0].amount || 0,
                      fee: 0,
                      transactionId: tx.transaction_id
                    };
                    
                    messagingStore.storeMessage(message, walletStore.address?.toString() || "");
                  break;
                }
                } catch (e: any) {
                  console.log(`API Messages: Failed to decrypt with receive key at index ${i}: ${e.message}`);
              }
            }
            
            // If still not decrypted, try with change keys
            if (!decryptionSuccess) {
                for (let i = 0; i < maxKeys && !decryptionSuccess; i++) {
                try {
                  console.log(`API Messages: Trying change key at index ${i}`);
                  const privateKey = privateKeyGenerator.changeKey(i);
                    const privateKeyHex = privateKey.toString();
                    console.log(`API Messages: Using change key ${privateKeyHex.substring(0, 8)}...`);
                    
                    // Use CipherHelper for robust decryption
                    const messageId = `${tx.transaction_id}_change_${i}`;
                    const result = await CipherHelper.tryDecrypt(encryptedContent, privateKeyHex, messageId);
                  
                  if (result) {
                    decryptedContent = result;
                    decryptionSuccess = true;
                      successfulKeyType = 'change';
                      successfulKeyIndex = i;
                      console.log(`API Messages: Successfully decrypted with change key at index ${i} (${privateKeyHex.substring(0, 8)}...)`);
                      
                      // Create and store the decrypted message
                      const message: Message = {
                        senderAddress: tx.outputs[0].script_public_key_address || "Unknown",
                        recipientAddress: walletStore.address?.toString() || "Unknown",
                        timestamp: tx.block_time || Date.now(),
                        content: decryptedContent,
                        payload: tx.payload,
                        amount: tx.outputs[0].amount || 0,
                        fee: 0,
                        transactionId: tx.transaction_id
                      };
                      
                      messagingStore.storeMessage(message, walletStore.address?.toString() || "");
                    break;
                  }
                  } catch (e: any) {
                    console.log(`API Messages: Failed to decrypt with change key at index ${i}: ${e.message}`);
                }
              }
            }
            
            if (!decryptionSuccess) {
                console.log(`API Messages: Could not decrypt message for transaction ${tx.transaction_id} after trying ${maxKeys} receive keys and ${maxKeys} change keys`);
              decryptedContent = "[Could not decrypt message]";
              } else {
                console.log(`API Messages: Successfully decrypted message using ${successfulKeyType} key at index ${successfulKeyIndex}`);
                console.log(`API Messages: Decrypted content: ${decryptedContent}`);
            }
          } catch (error) {
            console.error("API Messages: Error decrypting message:", error);
            decryptedContent = "[Decryption error]";
          }
        }
        
          // Only store messages that:
          // 1. We can decrypt, and
          // 2. Either contain one of our monitored aliases or are from/to our current address
          if (decryptedContent !== "[Could not decrypt message]" && 
              decryptedContent !== "[Decryption error]" && 
              decryptedContent !== "[Wallet locked]") {
            
            // Check if the message contains any of our monitored aliases
            const containsMonitoredAlias = Array.from(aliasToConversation.keys()).some(
              alias => decryptedContent.includes(alias)
            );

            // Store the message if it contains our alias or involves our current address
            if (containsMonitoredAlias || currentAddress === address) {
        // Create message data and store it
        const messageData = {
          transactionId: tx.transaction_id,
          senderAddress: senderAddress,
          recipientAddress: recipientAddress,
          timestamp: tx.block_time,
          payload: tx.payload,
          amount: tx.outputs[0]?.amount || 0,
          content: decryptedContent,
        };
        
        console.log(`API Messages: Storing message:`, messageData);
        
              // Store the message under our current address
              // This ensures all messages are accessible from our main wallet
              messagingStore.storeMessage(messageData, address);
            }
          }
        }
      }
      
      // Update UI with all messages
      messagingStore.loadMessages(address);
      
      console.log("API Messages: Fetch and process completed successfully");
      
    } catch (err) {
      console.error("API Messages: Error fetching and processing:", err);
      setError(`Error fetching messages: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-messages-button">
      <button 
        onClick={fetchAndProcessMessages} 
        disabled={loading}
        title={error ? `Error: ${error}` : "Fetch latest messages from blockchain"}
      >
        {loading ? "Loading..." : "Refresh Messages"}
      </button>
      {error && <div className="api-error-tooltip">{error}</div>}
    </div>
  );
}; 