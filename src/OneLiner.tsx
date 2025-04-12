// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { formatKasAmount } from "./utils/format";
import { checkKaswareAvailability } from "./utils/wallet-extension";
import {
  fetchKasplexData,
  KaspaClient,
  fetchAddressTransactions,
  fetchTransactionDetails,
} from "./utils/all-in-one";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, Message } from "./type/all";
import { amountFromMessage } from "./utils/amount-from-message";
import { useKaswareStore } from "./store/kasware.store";
import { KaswareNotInstalled } from "./components/KaswareNotInstalled";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { MessageDisplay } from "./components/MessageDisplay";

export const OneLiner: FC = () => {
  const isKaswareDetected = useKaswareStore((s) => s.isKaswareDetected);
  const refreshKaswareDetection = useKaswareStore(
    (s) => s.refreshKaswareDetection
  );
  const setSelectedAddress = useKaswareStore((s) => s.setSelectedAddress);
  const selectedAddress = useKaswareStore((s) => s.selectedAddress);
  const messageStore = useMessagingStore();

  const [isCreatingNewChat, setIsCreatingNewChat] = useState(true);
  const onNewChatClicked = useCallback(() => {
    const recipientInput = document.getElementById("recipientAddress");
    const messageInput = document.getElementById("messageInput");
    if (recipientInput && recipientInput instanceof HTMLInputElement)
      recipientInput.value = "";
    if (messageInput && messageInput instanceof HTMLInputElement)
      messageInput.value = "";

    messageStore.setOpenedRecipient(null);

    if (recipientInput) recipientInput.focus();

    setIsCreatingNewChat(true);
  }, [messageStore]);

  // @TODO(tech): refactor this
  // Function to set up a listener for a specific DAA score
  function setupDaaScoreListener(daaScore: string, txId: string) {
    // Create a unique event name for this DAA score
    const eventName = `daa-score-${daaScore}`;

    // Set up a one-time listener for this DAA score
    const listener = async () => {
      console.log(`DAA score ${daaScore} is now available on kasplex.org`);

      // Remove the listener after it's triggered
      window.removeEventListener(eventName, listener);

      // @TODO(functional): if no kasplex data, then setup saa score listener
      // If not found, set up a listener for when it becomes available
      // if (!kasplexData) {
      //     console.log(
      //       `Block with DAA score ${daaScore} not found on kasplex.org, setting up listener`
      //     );
      //     setupDaaScoreListener(daaScore, txId);
      //   }
      // Fetch the data from kasplex.org
      const kasplexData = await fetchKasplexData(daaScore);
      if (kasplexData) {
        // Find our transaction in the block
        const tx = kasplexData.result[0].txList.find(
          (tx: { txid: string }) => tx.txid === txId
        );
        if (tx) {
          const txData = JSON.parse(tx.data);

          // Get current address
          const currentAddress =
            document.querySelector(".address")?.textContent;
          if (!currentAddress) {
            console.error("Current address not found");
            return;
          }

          // Process the transaction data
          const messageData = processTransaction(
            {
              transactionId: txId,
              blockTime: txData.verboseData?.blockTime,
              payload: txData.payload,
              outputs: txData.outputs || [],
            },
            currentAddress
          );

          if (messageData) {
            // Update the UI with the new message
            const messagesList = document.querySelector(".messages-list");
            if (messagesList) {
              // Remove any existing message with this transaction ID
              const existingMessage = messagesList.querySelector(
                `[data-tx-id="${txId}"]`
              );
              if (existingMessage) {
                existingMessage.remove();
              }

              // Update contacts list
              messageStore.loadMessages(currentAddress);
            }
          }
        }
      }
    };

    // Add the listener
    window.addEventListener(eventName, listener);

    // Set up a polling mechanism to check for the DAA score
    const pollInterval = setInterval(async () => {
      const kasplexData = await fetchKasplexData(daaScore);
      if (kasplexData) {
        // Trigger the event when the DAA score is available
        window.dispatchEvent(new CustomEvent(eventName));
        clearInterval(pollInterval);
      }
    }, 5000); // Check every 5 seconds

    // Clear the interval after 5 minutes (to prevent infinite polling)
    setTimeout(() => {
      clearInterval(pollInterval);
      window.removeEventListener(eventName, listener);
      console.log(`Stopped polling for DAA score ${daaScore} after 5 minutes`);
    }, 5 * 60 * 1000);
  }

  const [currentClient, setCurrentClient] = useState<KaspaClient | null>();

  const [connectionStatus, setConnectionStatus] = useState(
    "Waiting for interaction"
  );
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  const connectToNetwork = useCallback(
    async (networkId: string) => {
      setConnectionStatus("Connecting...");

      try {
        // Disconnect existing client if any
        if (currentClient) {
          await currentClient.disconnect();
        }

        // Create new client and connect

        currentClient?.setNetworkId(networkId);
        await currentClient?.connect();

        setConnectionStatus("Connected to Kaspa Network");

        setIsNetworkSelectorVisible(false);
      } catch (error) {
        console.error("Failed to connect:", error);
        setConnectionStatus("Connection Failed");
      }
    },
    [currentClient, selectedNetwork]
  );

  // Helper function to store messages in localStorage
  const storeMessage = useCallback(
    (message: Message, walletAddress: string) => {
      const messagesMap = JSON.parse(
        localStorage.getItem("kaspa_messages_by_wallet") || "{}"
      );
      if (!messagesMap[walletAddress]) {
        messagesMap[walletAddress] = [];
      }
      messagesMap[walletAddress].push(message);
      localStorage.setItem(
        "kaspa_messages_by_wallet",
        JSON.stringify(messagesMap)
      );
    },
    []
  );

  const onSendClicked = useCallback(async () => {
    if (!selectedAddress) {
      alert("Shouldn't occurs, no selected address");
      return;
    }

    const messageInput = document.getElementById("messageInput");
    const recipientInput = document.getElementById("recipientAddress");

    if (
      !recipientInput ||
      !(recipientInput instanceof HTMLInputElement) ||
      !messageInput ||
      !(messageInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const message = messageInput.value.trim();
    const recipient = recipientInput.value.trim();

    if (!message) {
      alert("Please enter a message");
      return;
    }
    if (!recipient) {
      alert("Please enter a recipient address");
      return;
    }

    try {
      const amount = amountFromMessage(message);
      console.log("Sending transaction with amount:", amount, "sompi");

      const txResponse = await window.kasware.sendKaspa(
        recipient,
        amount.toString(),
        {
          payload: message,
          encoding: "utf8",
          mass: "1000000",
        }
      );

      console.log("Message sent! Transaction response:", txResponse);

      const txData =
        typeof txResponse === "string" ? JSON.parse(txResponse) : txResponse;
      const txId = txData.id || txData.transactionId || txResponse;

      const newMessageData: Message = {
        transactionId: txId,
        senderAddress: selectedAddress,
        recipientAddress: recipient,
        timestamp: Date.now(),
        content: message,
        amount: amount,
        payload: "",
      };

      storeMessage(newMessageData, selectedAddress);

      messageInput.value = "";
      recipientInput.value = "";

      messageStore.addMessages([newMessageData]);

      messageStore.setOpenedRecipient(recipient);
      setIsCreatingNewChat(false);
    } catch (error) {
      console.error("Error sending message:", error);

      alert(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  }, [messageStore, selectedAddress, storeMessage]);

  const processTransaction = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tx: any, address: string) => {
      // Get sender and recipient addresses from outputs
      let senderAddress = "";
      let recipientAddress = "";

      if (tx.outputs && tx.outputs.length > 0) {
        // First output is the recipient
        recipientAddress =
          tx.outputs[0].verboseData?.scriptPublicKeyAddress ||
          tx.outputs[0].scriptPublicKey?.address ||
          tx.outputs[0].script_public_key_address;

        // For incoming messages to us, the sender is in the second output
        // For outgoing messages from us, we are the sender
        if (recipientAddress === address) {
          // This is an incoming message to us
          senderAddress =
            tx.outputs.length > 1
              ? tx.outputs[1].verboseData?.scriptPublicKeyAddress ||
                tx.outputs[1].scriptPublicKey?.address ||
                tx.outputs[1].script_public_key_address
              : tx.outputs[0].verboseData?.scriptPublicKeyAddress ||
                tx.outputs[0].scriptPublicKey?.address ||
                tx.outputs[0].script_public_key_address;
        } else {
          // This is an outgoing message from us
          senderAddress = address;
        }
      }

      // Create message data
      const messageData: Message = {
        transactionId: tx.transactionId,
        senderAddress: senderAddress || "Unknown",
        recipientAddress: recipientAddress || "Unknown",
        timestamp: tx.blockTime || Date.now(),
        payload: tx.payload,
        amount: tx.outputs && tx.outputs[0] ? tx.outputs[0].amount : null,
        content: "",
      };

      // Store the message
      storeMessage(messageData, address);

      return messageData;
    },
    [storeMessage]
  );

  // Add new functions for contacts
  const updateContacts = useCallback(
    (messages: Message[], currentAddress: string) => {
      const contacts = new Map();

      messages.forEach((msg) => {
        const otherParty =
          msg.senderAddress === currentAddress
            ? msg.recipientAddress
            : msg.senderAddress;

        if (!contacts.has(otherParty)) {
          contacts.set(otherParty, {
            address: otherParty,
            lastMessage: msg,
            messages: [],
          });
        }
        contacts.get(otherParty).messages.push(msg);
      });

      return Array.from(contacts.values()).sort(
        (a, b) =>
          (b.lastMessage.timestamp || 0) - (a.lastMessage.timestamp || 0)
      );
    },
    []
  );

  const [isNetworkSelectorVisible, setIsNetworkSelectorVisible] =
    useState(false);
  const onNetworkBadgeClicked = useCallback(() => {
    setIsNetworkSelectorVisible(!isNetworkSelectorVisible);
  }, [isNetworkSelectorVisible]);

  // Kasware initialization
  useEffect(() => {
    setCurrentClient(new KaspaClient());

    (async () => {
      // Get network from kasware
      const kaswareNetwork: string | null = await window.kasware.getNetwork();

      // Map KasWare network to SDK network format
      const networkMap = {
        kaspa_mainnet: "mainnet",
        "kaspa-mainnet": "mainnet",
        kaspa_testnet_10: "testnet-10",
        "kaspa-testnet-10": "testnet-10",
        kaspa_testnet_11: "testnet-11",
        "kaspa-testnet-11": "testnet-11",
        kaspa_devnet: "devnet",
        "kaspa-devnet": "devnet",
      };

      // @TODO: proper network typing and unification
      const network: string = kaswareNetwork
        ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          networkMap[kaswareNetwork]
        : "";
      if (!network) {
        throw new Error(`Unsupported network: ${kaswareNetwork}`);
      }

      console.log("Kaspa network selected from KasWare network:", network);
      setSelectedNetwork(network);
    })();
  }, []);

  // Kasware detection
  useEffect(() => {
    console.log("KasWare detection effect triggered", selectedNetwork);
    if (!selectedNetwork) return;
    (async () => {
      // Connect to the network
      await connectToNetwork(selectedNetwork);

      const isKaswareAvailable = await checkKaswareAvailability();
      const transactionsNode = document.getElementById("transactions");

      if (isKaswareAvailable) {
        console.log("KasWare Wallet is installed!");

        if (transactionsNode) {
          transactionsNode.innerHTML =
            '<div class="info-message">KasWare Wallet detected. Click "Connect to Kasware" to view your transactions.</div>';
        }
      }
    })();
  }, [connectToNetwork, selectedNetwork]);

  // Connect button handler
  const onConnectClicked = useCallback(async () => {
    try {
      // kasware guard
      if (!isKaswareDetected) {
        const result = await refreshKaswareDetection();

        if (!result) {
          return;
        }
      }

      // Request accounts from the Kasware wallet
      const accounts = await window.kasware.requestAccounts();
      console.log("Connected to Kasware Wallet:", accounts);

      if (!accounts?.length) {
        console.warn("OnConnect - No account detected");
        return;
      }

      // Initialize conversations immediately after connecting
      const address = accounts[0];

      setSelectedAddress(address);

      // Load existing messages and initialize contacts
      const storedMessages = messageStore.loadMessages(address);
      console.log("Loaded stored messages:", storedMessages);

      // Then fetch transactions and update UI
      fetchTransactions(accounts);
    } catch (error) {
      console.error("Failed to connect to Kasware Wallet:", error);

      const transactionsNode = document.getElementById("transactions");
      if (transactionsNode) {
        transactionsNode.innerHTML = `<div class="error">Failed to connect to Kasware Wallet: ${unknownErrorToErrorLike(
          error
        )}</div>`;
      }
    }
  }, [isKaswareDetected]);

  const onContactClicked = useCallback(
    (contact: Contact) => {
      if (!selectedAddress) {
        console.error("No selected address");
        return;
      }

      setIsCreatingNewChat(false);
      messageStore.setOpenedRecipient(contact.address);

      // Show recipient address in input when selecting a conversation
      const recipientInput = document.getElementById("recipientAddress");
      if (recipientInput && recipientInput instanceof HTMLInputElement) {
        recipientInput.value = contact.address;
      }
    },
    [messageStore, selectedAddress]
  );

  const startUtxoListener = useCallback(
    async (address: string) => {
      if (!currentClient) {
        console.log("UTXO listener - No current client initialized");
        return;
      }

      console.log("Starting UTXO listener for address:", address);

      try {
        // Subscribe to UTXO changes
        await currentClient.subscribeToUtxoChanges(
          [address],
          async (notification) => {
            console.log("UTXO change notification received:", notification);

            // Wait a short moment for the transaction to be available
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get all transactions for the address
            const transactions = await fetchAddressTransactions(address);
            console.log(
              "Fetched transactions after UTXO change:",
              transactions
            );

            if (transactions && transactions.transactions) {
              // Load existing messages
              const existingMessages = messageStore.loadMessages(address);
              const existingTxIds = new Set(
                existingMessages.map(
                  (msg: { transactionId: string }) => msg.transactionId
                )
              );

              let hasNewMessages = false;

              // Process new transactions
              for (const tx of transactions.transactions) {
                // Skip if we already have this transaction
                if (existingTxIds.has(tx.transactionId)) {
                  console.log(
                    "Skipping existing transaction:",
                    tx.transactionId
                  );
                  continue;
                }

                if (!tx.payload) {
                  console.log(
                    "Skipping transaction with no payload:",
                    tx.transactionId
                  );
                  continue;
                }

                console.log("Processing new transaction:", tx);
                hasNewMessages = true;

                // Process and store the new message
                processTransaction(tx, address);

                // Play notification sound
                const audio = new Audio(
                  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAkJCQkJCQkJCQkJCQkJCQwMDAwMDAwMDAwMDAwMDAwMD///////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbBE6LrOAAAAAAD/+8DEAAAJkAF59BEABGjQL3c2IgAgACAAIAMfB8H4Pg+D7/wQiCEIQhD4Pg+D4IQhCEIQh8HwfB8EIQhCEP/B8HwfBCEIQhCHwfB8HwfBCEIQhCEPg+D4PghCEIQhD4Pg+D4IQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhCHwfB8HwQhCEIQh8HwfB8EIQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhD4Pg+D4AAAAA"
                );
                audio.play().catch((e) => console.log("Audio play failed:", e));
              }

              if (hasNewMessages) {
                // Update contacts list
                messageStore.loadMessages(address);
              }
            }

            // Update balance display
            const balance = await window.kasware.getBalance(address);
            if (balance) {
              const balanceInfoNode = document.querySelector(".balance-info");

              if (balanceInfoNode) {
                balanceInfoNode.innerHTML = `
                    <h4>Balance</h4>
                    <ul class="balance-list">
                        <li><strong>Total:</strong> <span class="amount">${formatKasAmount(
                          balance.total
                        )} KAS</span></li>
                        <li><strong>Confirmed:</strong> <span class="amount">${formatKasAmount(
                          balance.confirmed
                        )} KAS</span></li>
                        <li><strong>Unconfirmed:</strong> <span class="amount">${formatKasAmount(
                          balance.unconfirmed
                        )} KAS</span></li>
                    </ul>
                `;
              }
            }
          }
        );

        console.log("UTXO listener started successfully");
      } catch (error) {
        console.error(error);
      }
    },
    [currentClient, messageStore, processTransaction]
  );

  const fetchTransactions = useCallback(
    async (accounts: string[]) => {
      if (!accounts || !accounts.length) return;

      try {
        const address = accounts[0];
        console.log("Fetching transactions for address:", address);

        const isKaswareAvailable = await checkKaswareAvailability();
        if (!isKaswareAvailable) {
          throw new Error("Kasware wallet is not available");
        }

        try {
          // Get UTXO entries for the address using the correct method
          console.log("Fetching UTXO entries for address:", address);
          const utxoEntries = await window.kasware.getUtxoEntries(address);
          console.log("UTXO entries:", utxoEntries);

          // Get balance for the address
          const balance = await window.kasware.getBalance(address);
          console.log("Balance:", balance);

          // Get transactions for the address
          console.log("Fetching transactions for address:", address);

          // Get transaction IDs from wallet UTXOs
          const txIds = new Set<string>();

          // Add transaction IDs from wallet UTXOs
          if (utxoEntries && utxoEntries.length > 0) {
            utxoEntries.forEach(
              (utxo: { outpoint?: { transactionId: string } }) => {
                if (utxo.outpoint?.transactionId) {
                  txIds.add(utxo.outpoint.transactionId);
                }
              }
            );
          }

          // Fetch full details for each transaction
          const transactions = {
            transactions: await Promise.all(
              Array.from(txIds).map(async (txId) => {
                const txDetails = await fetchTransactionDetails(txId);
                return txDetails;
              })
            ).then((txs) => txs.filter((tx) => tx !== null)),
          };

          console.log("Transactions:", transactions);

          // Process transactions to extract messages
          if (transactions && transactions.transactions) {
            // Load existing messages to avoid duplicates
            const existingMessages = messageStore.loadMessages(address);
            const existingTxIds = new Set(
              existingMessages.map(
                (msg: { transactionId: string }) => msg.transactionId
              )
            );

            console.log(
              "Processing transactions for messages:",
              transactions.transactions
            );

            // Process each transaction
            for (const tx of transactions.transactions) {
              // Skip if we already have this transaction
              if (existingTxIds.has(tx.transactionId)) {
                console.log("Skipping existing transaction:", tx.transactionId);
                continue;
              }

              // Skip if no payload
              if (!tx.payload) {
                console.log(
                  "Skipping transaction with no payload:",
                  tx.transactionId
                );
                continue;
              }

              console.log("Processing transaction:", tx);

              // Get sender and recipient addresses from outputs
              let senderAddress = "";
              let recipientAddress = "";

              if (tx.outputs && tx.outputs.length > 0) {
                // First output is the recipient
                recipientAddress =
                  tx.outputs[0].verboseData?.scriptPublicKeyAddress ||
                  tx.outputs[0].scriptPublicKey?.address ||
                  tx.outputs[0].script_public_key_address;

                // For incoming messages to us, the sender is in the second output
                // For outgoing messages from us, we are the sender
                if (recipientAddress === address) {
                  // This is an incoming message to us
                  senderAddress =
                    tx.outputs.length > 1
                      ? tx.outputs[1].verboseData?.scriptPublicKeyAddress ||
                        tx.outputs[1].scriptPublicKey?.address ||
                        tx.outputs[1].script_public_key_address
                      : tx.outputs[0].verboseData?.scriptPublicKeyAddress ||
                        tx.outputs[0].scriptPublicKey?.address ||
                        tx.outputs[0].script_public_key_address;
                } else {
                  // This is an outgoing message from us
                  senderAddress = address;
                }
              }

              // Create message data
              const messageData: Message = {
                transactionId: tx.transactionId,
                senderAddress: senderAddress || "Unknown",
                recipientAddress: recipientAddress || "Unknown",
                timestamp: tx.blockTime || Date.now(),
                payload: tx.payload,
                amount:
                  tx.outputs && tx.outputs[0] ? tx.outputs[0].amount : null,
                content: "",
              };

              console.log("Storing message data:", messageData);

              // Store the message
              storeMessage(messageData, address);
            }

            // Update UI with all messages
            const allMessages = messageStore.loadMessages(address);
            console.log("All messages after processing:", allMessages);
          }

          // Display the wallet information
          const container = document.getElementById("transactions");

          const dataContainer = document.createElement("div");
          dataContainer.className = "data-container";

          if (container) {
            container.innerHTML = `
                        <div class="info-message">
                            <h3>Wallet Information</h3>
                            <p><strong>Address:</strong> <span class="address">${address}</span></p>
                            <div class="balance-info">
                                <h4>Balance</h4>
                                <ul class="balance-list">
                                    <li><strong>Total:</strong> <span class="amount">${formatKasAmount(
                                      balance.total
                                    )} KAS</span></li>
                                    <li><strong>Confirmed:</strong> <span class="amount">${formatKasAmount(
                                      balance.confirmed
                                    )} KAS</span></li>
                                    <li><strong>Unconfirmed:</strong> <span class="amount">${formatKasAmount(
                                      balance.unconfirmed
                                    )} KAS</span></li>
                                </ul>
                            </div>
                            <p><strong>UTXO Entries:</strong> <span class="utxo-count">${
                              utxoEntries ? utxoEntries.length : 0
                            }</span></p>
                        </div>
                    `;

            // Create container for messages
            container.appendChild(dataContainer);
          }

          // Initialize contacts and messages
          const messagesList = document.querySelector(".messages-list");

          // Update contacts list
          messageStore.loadMessages(address);

          // Initialize WebSocket subscription for live updates
          subscribeToNewTransactions(address);

          // Add event listener for clear history button
          const clearHistoryButton = document.querySelector(
            "#clearHistoryButton"
          );
          clearHistoryButton?.addEventListener("click", () => {
            if (
              confirm(
                "Are you sure you want to clear all message history? This cannot be undone."
              )
            ) {
              const messagesMap = JSON.parse(
                localStorage.getItem("kaspa_messages_by_wallet") || "{}"
              );
              delete messagesMap[address];
              localStorage.setItem(
                "kaspa_messages_by_wallet",
                JSON.stringify(messagesMap)
              );

              if (messagesList) {
                messagesList.innerHTML =
                  '<div class="no-messages">No messages found.</div>';
              }
            }
          });

          // Add event listener for Enter key in message input
          const messageInput = document.getElementById("messageInput");
          if (messageInput) {
            messageInput.addEventListener("keypress", (e) => {
              if (e.key === "Enter") {
                const button = document.getElementById("sendButton");
                if (button) button.click();
              }
            });
          }

          messageStore.setIsLoaded(true);

          return transactions.transactions;
        } catch (error) {
          console.error("Error fetching data:", error);
          const transactionsNode = document.getElementById("transactions");
          if (transactionsNode) {
            transactionsNode.innerHTML = `<div class="error">Failed to fetch data: ${unknownErrorToErrorLike(
              error
            )}</div>`;
          }
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);

        const transactionsNode = document.getElementById("transactions");
        if (transactionsNode) {
          transactionsNode.innerHTML = `<div class="error">Failed to fetch transactions: ${error}</div>`;
        }
      }
    },
    [
      // @NOTE: voluntary omit of one of the deps as it is a circular dep (a->b and b->a)
      messageStore.loadMessages,
      storeMessage,
      updateContacts,
    ]
  );

  const subscribeToNewTransactions: (address: string) => Promise<void> =
    useCallback(
      async (address: string) => {
        try {
          if (!currentClient || !currentClient.rpc) {
            console.error("RPC client not initialized");
            return;
          }

          console.log("Starting subscription for address:", address);

          // Subscribe to UTXO changes using the RPC client
          await currentClient.rpc.subscribeUtxosChanged(
            [address],
            // @QUESTION: i had to lie to the typing system, it says it doesn't take a callback parameter, not sure if it's true
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            async (notification) => {
              console.log("UTXO change notification received:", notification);

              // Wait a short moment for the transaction to be available
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Fetch latest transactions
              const transactions = await fetchTransactions([address]);

              if (transactions) {
                // Process only new transactions
                const existingMessages = messageStore.loadMessages(address);
                const existingTxIds = new Set(
                  existingMessages.map((msg) => msg.transactionId)
                );

                const newMessages = [];

                for (const tx of transactions) {
                  // Skip if we already have this transaction
                  if (existingTxIds.has(tx.transactionId)) {
                    continue;
                  }

                  // Skip if no payload
                  if (!tx.payload) {
                    continue;
                  }

                  // Process and store the new message
                  const messageData = processTransaction(tx, address);
                  if (messageData) {
                    newMessages.push(messageData);
                  }
                }

                if (newMessages.length > 0) {
                  console.log("New messages received:", newMessages);

                  // Update UI with all messages
                  messageStore.loadMessages(address);

                  // Play notification sound
                  const audio = new Audio(
                    "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAkJCQkJCQkJCQkJCQkJCQwMDAwMDAwMDAwMDAwMDAwMD///////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbBE6LrOAAAAAAD/+8DEAAAJkAF59BEABGjQL3c2IgAgACAAIAMfB8H4Pg+D7/wQiCEIQhD4Pg+D4IQhCEIQh8HwfB8EIQhCEP/B8HwfBCEIQhCHwfB8HwfBCEIQhCEPg+D4PghCEIQhD4Pg+D4IQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhCHwfB8HwQhCEIQh8HwfB8EIQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhD4Pg+D4AAAAA"
                  );
                  audio
                    .play()
                    .catch((e) => console.log("Audio play failed:", e));
                }
              }
            }
          );

          console.log("Successfully subscribed to UTXO changes");
        } catch (error) {
          console.error("Error subscribing to transactions:", error);
        }
      },
      [currentClient, fetchTransactions, messageStore, processTransaction]
    );

  return (
    <>
      <div className="header-container">
        <h1>Messaging Page</h1>
        <div className="network-selector-container">
          <div onClick={onNetworkBadgeClicked} className="network-badge">
            Mainnet
          </div>
          {isNetworkSelectorVisible ? (
            <div className="network-selector">
              <div
                className="network-option active"
                data-network="mainnet"
                onClick={() => connectToNetwork("mainnet")}
              >
                Mainnet
              </div>
              <div
                className="network-option"
                data-network="testnet-10"
                onClick={() => connectToNetwork("testnet-10")}
              >
                Testnet 10
              </div>
            </div>
          ) : null}
        </div>
        <div className="connection-status">{connectionStatus}</div>
      </div>
      <button onClick={onConnectClicked} id="connectButton">
        Connect to Kasware
      </button>
      {isKaswareDetected === false ? <KaswareNotInstalled /> : null}
      {messageStore.isLoaded ? (
        <div className="messages-container">
          <div className="contacts-sidebar">
            <div className="contacts-header">
              <h3>Conversations</h3>
              <button
                onClick={onNewChatClicked}
                className="new-conversation-btn"
              >
                New Chat
              </button>
            </div>
            <div className="contacts-list">
              {messageStore.contacts.map((c) => (
                <ContactCard
                  isSelected={c.address === messageStore.openedRecipient}
                  key={c.address}
                  contact={c}
                  onClick={onContactClicked}
                />
              ))}
            </div>
          </div>
          <div className="messages-section">
            <div className="messages-header">
              <h3>Messages</h3>
              <button id="clearHistoryButton" className="clear-history-button">
                Clear History
              </button>
            </div>
            <div className="messages-list">
              {isCreatingNewChat ? (
                <div className="no-messages">
                  Enter a recipient address to start a new conversation.
                </div>
              ) : messageStore.messagesOnOpenedRecipient.length ? (
                messageStore.messagesOnOpenedRecipient.map((msg) => (
                  <MessageDisplay
                    isOutgoing={msg.senderAddress === selectedAddress}
                    key={msg.transactionId}
                    message={msg}
                  />
                ))
              ) : (
                <div className="no-messages">
                  No messages in this conversation.
                </div>
              )}
            </div>
            <div className="message-input-section">
              <div className="message-input-container">
                <input
                  type="text"
                  id="recipientAddress"
                  placeholder="Recipient address"
                  className="recipient-input"
                />
                <div className="message-input-wrapper">
                  <input
                    type="text"
                    id="messageInput"
                    placeholder="Type your message..."
                    className="message-input"
                  />
                  <button
                    onClick={onSendClicked}
                    id="sendButton"
                    className="send-button"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div id="transactions"></div>
    </>
  );
};
