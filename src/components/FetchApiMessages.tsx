import { FC, useState, useEffect } from "react";
import { useWalletStore } from "../store/wallet.store";
import { useMessagingStore } from "../store/messaging.store";
import { WalletStorage } from "../utils/wallet-storage";
import { Transaction } from "../types/all";
import { getApiEndpoint } from "../config/nodes";
import "./FetchApiMessages.css";
import { CipherHelper } from "../utils/cipher-helper";
import { DecryptionCache } from "../utils/decryption-cache";
import { Message } from "../types/all";
import { unknownErrorToErrorLike } from "../utils/errors";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

type FetchApiMessagesProps = {
  address: string;
};

export const FetchApiMessages: FC<FetchApiMessagesProps> = ({ address }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletStore = useWalletStore();
  const unlockedWallet = useWalletStore((s) => s.unlockedWallet);
  const messagingStore = useMessagingStore();

  useEffect(() => {
    if (address && unlockedWallet) {
      fetchAndProcessMessages();
    }
  }, [address, unlockedWallet]);

  // Add event listener for triggering API fetch from localStorage
  useEffect(() => {
    const handleTriggerApiFetch = (event: CustomEvent) => {
      const { address: eventAddress } = event.detail;
      console.log(
        "Received kasia-trigger-api-fetch event for address:",
        eventAddress
      );

      // Only trigger if this component matches the address
      if (eventAddress === address && walletStore.unlockedWallet) {
        console.log("Triggering API fetch due to localStorage flag");
        fetchAndProcessMessages();
      }
    };

    // Listen for the custom event
    window.addEventListener(
      "kasia-trigger-api-fetch",
      handleTriggerApiFetch as EventListener
    );

    // Cleanup
    return () => {
      window.removeEventListener(
        "kasia-trigger-api-fetch",
        handleTriggerApiFetch as EventListener
      );
    };
  }, [address, unlockedWallet]);

  const fetchAndProcessMessages = async () => {
    setLoading(true);
    setError(null);

    if (!walletStore.unlockedWallet || !walletStore.unlockedWallet.password) {
      return;
    }

    // Get the private key generator
    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      walletStore.unlockedWallet,
      walletStore.unlockedWallet.password
    );

    try {
      // Get the current network from the wallet store
      const networkId = walletStore.selectedNetwork;
      const baseUrl = getApiEndpoint(networkId);

      // Get all addresses and aliases we need to monitor
      const monitoredConversations =
        messagingStore.conversationManager?.getMonitoredConversations() || [];
      const uniqueAddresses = new Set([
        address, // Always include our current address
        ...monitoredConversations.map((conv) => conv.address),
      ]);

      // Create a map of aliases to conversation IDs for quick lookup
      const aliasToConversation = new Map();
      monitoredConversations.forEach((conv) => {
        aliasToConversation.set(conv.alias, conv.address);
      });

      // Load existing messages to avoid duplicates
      const existingMessages = messagingStore.loadMessages(address);
      const existingTxIds = new Set(
        existingMessages.map((msg) => msg.transactionId)
      );

      // Fetch and process messages for each address, in parallel
      await Promise.allSettled(
        [...uniqueAddresses].map(async (currentAddress) => {
          // Ensure the address is properly formatted for the API
          const formattedAddress = currentAddress.includes(":")
            ? encodeURIComponent(currentAddress)
            : encodeURIComponent(
                `${
                  networkId === "mainnet" ? "kaspa:" : "kaspatest:"
                }${currentAddress}`
              );

          const apiUrl = `${baseUrl}/addresses/${formattedAddress}/full-transactions-page?limit=50&before=0&after=0&resolve_previous_outpoints=light`;

          console.log(
            `API Messages: Fetching from URL for address ${currentAddress}:`,
            apiUrl
          );

          const response = await fetch(apiUrl);
          if (!response.ok) {
            console.error(
              `API error for address ${currentAddress}: ${response.status} ${response.statusText}`
            );
            return;
          }

          const transactions: Transaction[] = await response.json();
          console.log(
            `API Messages: Fetched ${transactions.length} transactions for ${currentAddress}`
          );

          // Process only encrypted message transactions
          const messageTxs = transactions.filter(
            (tx) => tx.payload && tx.payload.startsWith("636970685f6d73673a")
          );

          console.log(
            `API Messages: Found ${messageTxs.length} encrypted message transactions for ${currentAddress}`
          );

          // Process each transaction
          for (const tx of messageTxs) {
            // Skip if we already have this transaction
            if (existingTxIds.has(tx.transaction_id)) {
              console.log(
                `API Messages: Skipping existing transaction: ${tx.transaction_id}`
              );
              continue;
            }

            // 🚀 OPTIMIZATION: Skip if we know this transaction failed decryption before
            if (DecryptionCache.hasFailed(currentAddress, tx.transaction_id)) {
              console.log(
                `API Messages: Skipping known failed decryption: ${tx.transaction_id}`
              );
              continue;
            }

            console.log(
              `API Messages: Processing new transaction: ${tx.transaction_id}`,
              { tx }
            );

            // For each transaction, determine if this is incoming or outgoing
            // Use the original logic to preserve existing functionality
            const recipientAddress =
              tx.outputs[0]?.script_public_key_address || "Unknown";
            const isIncoming = recipientAddress === currentAddress;
            let senderAddress = isIncoming
              ? tx.inputs[0]?.previous_outpoint_address || "Unknown"
              : currentAddress;

            console.log(`API Messages: Transaction ${tx.transaction_id}:`);
            console.log(`- Current address: ${currentAddress}`);
            console.log(`- Recipient address: ${recipientAddress}`);
            console.log(`- Is incoming: ${isIncoming}`);
            console.log(
              `- Input[0] previous_outpoint_address: ${tx.inputs[0]?.previous_outpoint_address}`
            );
            console.log(`- Determined sender address: ${senderAddress}`);

            // Try to decrypt the message
            let decryptedContent = "";

            if (walletStore.unlockedWallet) {
              try {
                // Extract the encrypted part (remove the "ciph_msg:" prefix)
                const prefix = "636970685f6d73673a"; // hex for "ciph_msg:"
                if (!tx.payload.startsWith(prefix)) {
                  console.log(
                    `API Messages: Invalid message format, missing prefix: ${tx.payload.substring(
                      0,
                      20
                    )}...`
                  );
                  continue;
                }

                console.log(`API Messages: Full payload: ${tx.payload}`);
                const messageHex = tx.payload.substring(prefix.length);
                console.log(
                  `API Messages: Message hex after prefix: ${messageHex}`
                );

                const handshakePrefix = "313a68616e647368616b653a"; // "1:handshake:"
                const commPrefix = "313a636f6d6d3a"; // "1:comm:"
                const paymentPrefix = "313a7061796d656e743a"; // "1:payment:"

                let messageType = "unknown";
                let isHandshake = false;
                let targetAlias = null;
                let encryptedContent = messageHex; // Default to full message for handshakes

                if (messageHex.startsWith(handshakePrefix)) {
                  messageType = "handshake";
                  isHandshake = true;
                  encryptedContent = messageHex;
                } else if (messageHex.startsWith(commPrefix)) {
                  // Parse regular messages
                  const hexToString = (hex: string) => {
                    const hexArray = hex.match(/.{1,2}/g) || [];
                    return hexArray
                      .map((byte) => String.fromCharCode(parseInt(byte, 16)))
                      .join("");
                  };

                  const messageStr = hexToString(messageHex);
                  const parts = messageStr.split(":");

                  if (parts.length >= 4) {
                    messageType = "comm";
                    targetAlias = parts[2];
                    encryptedContent = parts[3];
                  }
                } else if (messageHex.startsWith(paymentPrefix)) {
                  // Parse payment messages - simplified format without aliases
                  const hexToString = (hex: string) => {
                    const hexArray = hex.match(/.{1,2}/g) || [];
                    return hexArray
                      .map((byte) => String.fromCharCode(parseInt(byte, 16)))
                      .join("");
                  };

                  const messageStr = hexToString(messageHex);
                  const parts = messageStr.split(":");

                  if (parts.length >= 3) {
                    messageType = "payment";
                    // No alias needed - parts[2] is the encrypted content
                    encryptedContent = parts[2];
                  }
                }

                console.log(`API Messages: Parsed message parts:`);
                console.log(`- Type: ${messageType}`);
                console.log(`- Is Handshake: ${isHandshake}`);
                console.log(`- Target Alias: ${targetAlias}`);
                console.log(
                  `- Encrypted content (first 40 chars): ${encryptedContent?.substring(
                    0,
                    40
                  )}...`
                );

                if (!encryptedContent) {
                  console.log("API Messages: No encrypted content found");
                  continue;
                }

                console.log(
                  `API Messages: Using wallet derivation type: ${walletStore.unlockedWallet.derivationType}`
                );

                // Try multiple private keys
                const maxKeys = 1; // Try up to 20 keys for each type
                let decryptionSuccess = false;
                let successfulKeyType = "";
                let successfulKeyIndex = -1;

                // First try with receive keys (standard addresses)
                for (let i = 0; i < maxKeys && !decryptionSuccess; i++) {
                  try {
                    console.log(
                      `API Messages: Trying receive key at index ${i}`
                    );
                    const privateKey = privateKeyGenerator.receiveKey(i);
                    const privateKeyHex = privateKey.toString();
                    console.log(
                      `API Messages: Using receive key ${privateKeyHex.substring(
                        0,
                        8
                      )}...`
                    );

                    // Use CipherHelper for robust decryption
                    const messageId = `${tx.transaction_id}_receive_${i}`;
                    const result = await CipherHelper.tryDecrypt(
                      encryptedContent,
                      privateKeyHex,
                      messageId
                    );

                    if (result) {
                      decryptedContent = result;
                      decryptionSuccess = true;
                      successfulKeyType = "receive";
                      successfulKeyIndex = i;
                      console.log(
                        `API Messages: Successfully decrypted with receive key at index ${i} (${privateKeyHex.substring(
                          0,
                          8
                        )}...)`
                      );

                      // If this is a handshake message and sender is still unknown, try to extract from payload
                      if (
                        senderAddress === "Unknown" &&
                        result.includes("handshake")
                      ) {
                        try {
                          const handshakeMatch = result.match(
                            /ciph_msg:1:handshake:(.+)/
                          );
                          if (handshakeMatch) {
                            const handshakeData = JSON.parse(handshakeMatch[1]);
                            // For handshake responses, look for the original recipient address
                            if (
                              handshakeData.isResponse &&
                              handshakeData.recipientAddress
                            ) {
                              // In a handshake response, the recipientAddress field contains the original initiator's address
                              console.log(
                                `API Messages: Extracted sender from handshake response: ${handshakeData.recipientAddress}`
                              );
                              senderAddress = handshakeData.recipientAddress;
                            } else if (!handshakeData.isResponse) {
                              // For initial handshakes, try to find sender from transaction outputs
                              const changeOutput = tx.outputs.find(
                                (output) =>
                                  output.script_public_key_address !==
                                  currentAddress
                              );
                              if (changeOutput) {
                                console.log(
                                  `API Messages: Extracted sender from transaction outputs: ${changeOutput.script_public_key_address}`
                                );
                                senderAddress =
                                  changeOutput.script_public_key_address ||
                                  "Unknown";
                              }
                            }
                          }
                        } catch (e) {
                          console.log(
                            `API Messages: Could not extract sender from handshake payload: ${e}`
                          );
                        }
                      }

                      // Create and store the decrypted message
                      const message: Message = {
                        senderAddress: senderAddress,
                        recipientAddress: recipientAddress,
                        timestamp: tx.block_time || Date.now(),
                        content: result,
                        payload: tx.payload,
                        amount: tx.outputs[0].amount || 0,
                        fee: 0,
                        transactionId: tx.transaction_id,
                      };

                      messagingStore.storeMessage(
                        message,
                        walletStore.address?.toString() || ""
                      );
                      break;
                    }
                  } catch (error) {
                    console.log(
                      `API Messages: Failed to decrypt with receive key at index ${i}: ${
                        unknownErrorToErrorLike(error).message
                      }`
                    );
                  }
                }

                // If still not decrypted, try with change keys
                if (!decryptionSuccess) {
                  for (let i = 0; i < maxKeys && !decryptionSuccess; i++) {
                    try {
                      console.log(
                        `API Messages: Trying change key at index ${i}`
                      );
                      const privateKey = privateKeyGenerator.changeKey(i);
                      const privateKeyHex = privateKey.toString();
                      console.log(
                        `API Messages: Using change key ${privateKeyHex.substring(
                          0,
                          8
                        )}...`
                      );

                      // Use CipherHelper for robust decryption
                      const messageId = `${tx.transaction_id}_change_${i}`;
                      const result = await CipherHelper.tryDecrypt(
                        encryptedContent,
                        privateKeyHex,
                        messageId
                      );

                      if (result) {
                        decryptedContent = result;
                        decryptionSuccess = true;
                        successfulKeyType = "change";
                        successfulKeyIndex = i;
                        console.log(
                          `API Messages: Successfully decrypted with change key at index ${i} (${privateKeyHex.substring(
                            0,
                            8
                          )}...)`
                        );

                        // If this is a handshake message and sender is still unknown, try to extract from payload
                        if (
                          senderAddress === "Unknown" &&
                          result.includes("handshake")
                        ) {
                          try {
                            const handshakeMatch = result.match(
                              /ciph_msg:1:handshake:(.+)/
                            );
                            if (handshakeMatch) {
                              const handshakeData = JSON.parse(
                                handshakeMatch[1]
                              );
                              // For handshake responses, look for the original recipient address
                              if (
                                handshakeData.isResponse &&
                                handshakeData.recipientAddress
                              ) {
                                // In a handshake response, the recipientAddress field contains the original initiator's address
                                console.log(
                                  `API Messages: Extracted sender from handshake response: ${handshakeData.recipientAddress}`
                                );
                                senderAddress = handshakeData.recipientAddress;
                              } else if (!handshakeData.isResponse) {
                                // For initial handshakes, try to find sender from transaction outputs
                                const changeOutput = tx.outputs.find(
                                  (output) =>
                                    output.script_public_key_address !==
                                    currentAddress
                                );
                                if (changeOutput) {
                                  console.log(
                                    `API Messages: Extracted sender from transaction outputs: ${changeOutput.script_public_key_address}`
                                  );
                                  senderAddress =
                                    changeOutput.script_public_key_address ||
                                    "Unknown";
                                }
                              }
                            }
                          } catch (e) {
                            console.log(
                              `API Messages: Could not extract sender from handshake payload: ${e}`
                            );
                          }
                        }

                        // Create and store the decrypted message
                        const message: Message = {
                          senderAddress: senderAddress,
                          recipientAddress: recipientAddress,
                          timestamp: tx.block_time || Date.now(),
                          content: result,
                          payload: tx.payload,
                          amount: tx.outputs[0].amount || 0,
                          fee: 0,
                          transactionId: tx.transaction_id,
                        };

                        messagingStore.storeMessage(
                          message,
                          walletStore.address?.toString() || ""
                        );
                        break;
                      }
                    } catch (error) {
                      console.log(
                        `API Messages: Failed to decrypt with change key at index ${i}: ${
                          unknownErrorToErrorLike(error).message
                        }`
                      );
                    }
                  }
                }

                // If still not decrypted and we're using standard derivation, try legacy derivation
                if (
                  !decryptionSuccess &&
                  walletStore.unlockedWallet.derivationType === "standard"
                ) {
                  console.log(
                    `API Messages: Trying legacy derivation keys as fallback...`
                  );
                }

                // 🚀 OPTIMIZATION: Mark decryption result in cache
                if (!decryptionSuccess) {
                  DecryptionCache.markFailed(currentAddress, tx.transaction_id);
                  console.log(
                    `API Messages: Could not decrypt message for transaction ${
                      tx.transaction_id
                    } after trying ${maxKeys} receive keys and ${maxKeys} change keys${
                      walletStore.unlockedWallet.derivationType === "standard"
                        ? " and legacy keys"
                        : ""
                    } - marked as failed in cache`
                  );
                  decryptedContent = "[Could not decrypt message]";
                } else {
                  DecryptionCache.markSuccess(
                    currentAddress,
                    tx.transaction_id
                  );
                  console.log(
                    `API Messages: Successfully decrypted message using ${successfulKeyType} key at index ${successfulKeyIndex} - removed from failed cache if present`
                  );
                  console.log(
                    `API Messages: Decrypted content: ${decryptedContent}`
                  );
                }
              } catch (error) {
                console.error("API Messages: Error decrypting message:", error);
                decryptedContent = "[Decryption error]";
              }
            }

            // Only store messages that:
            // 1. We can decrypt, and
            // 2. Either contain one of our monitored aliases or are from/to our current address
            if (
              decryptedContent !== "[Could not decrypt message]" &&
              decryptedContent !== "[Decryption error]" &&
              decryptedContent !== "[Wallet locked]"
            ) {
              // Check if the message contains any of our monitored aliases
              const containsMonitoredAlias = Array.from(
                aliasToConversation.keys()
              ).some((alias) => decryptedContent.includes(alias));

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
        })
      );

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
    <div>
      <button
        onClick={fetchAndProcessMessages}
        disabled={loading}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2",
          { "cursor-not-allowed": loading }
        )}
        title={
          error ? `Error: ${error}` : "Fetch latest messages from blockDAG"
        }
      >
        {loading ? (
          <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
        ) : (
          <ArrowPathIcon className="h-6 w-6 text-[#49EACB] hover:scale-110" />
        )}
      </button>
      {error && <div className="api-error-tooltip">{error}</div>}
    </div>
  );
};
