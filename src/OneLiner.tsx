// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { checkKaswareAvailability } from "./utils/wallet-extension";
import {
  fetchKasplexData,
  KaspaClient,
  fetchAddressTransactions,
  fetchTransactionDetails,
} from "./utils/all-in-one";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, Message, NetworkType } from "./type/all";
import { useKaswareStore } from "./store/kasware.store";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { MessageDisplay } from "./components/MessageDisplay";
import { NetworkSelector } from "./containers/NetworkSelector";
import { WalletInfo } from "./components/WalletInfo";
import { SendMessageForm } from "./containers/SendMessageForm";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";

export const OneLiner: FC = () => {
  const isKaswareDetected = useKaswareStore((s) => s.isKaswareDetected);
  const refreshKaswareDetection = useKaswareStore(
    (s) => s.refreshKaswareDetection
  );
  const populateKaswareInformation = useKaswareStore(
    (s) => s.populateKaswareInformation
  );
  const switchKaswareNetwork = useKaswareStore((s) => s.switchKaswareNetwork);
  const getKaswareCurrentNetwork = useKaswareStore(
    (s) => s.getKaswareCurrentNetwork
  );
  const balance = useKaswareStore((s) => s.balance);
  const utxoEntries = useKaswareStore((s) => s.utxoEntries);
  const setSelectedAddress = useKaswareStore((s) => s.setSelectedAddress);
  const selectedAddress = useKaswareStore((s) => s.selectedAddress);
  const messageStore = useMessagingStore();

  const walletStore = useWalletStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  const onWalletUnlocked = useCallback(() => {
    setIsWalletReady(true);
  }, []);

  const onNewChatClicked = useCallback(() => {
    messageStore.setIsCreatingNewChat(true);
  }, [messageStore]);

  const onClearHistory = useCallback(() => {
    if (!selectedAddress) {
      return;
    }

    if (
      confirm(
        "Are you sure you want to clear all message history? This cannot be undone."
      )
    ) {
      messageStore.flushCache(selectedAddress);
    }
  }, [selectedAddress, messageStore]);

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
          if (!selectedAddress) {
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
            selectedAddress
          );

          if (messageData) {
            messageStore.loadMessages(selectedAddress);
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
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | null>(
    null
  );

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
      } catch (error) {
        console.error("Failed to connect:", error);
        setConnectionStatus("Connection Failed");
      }
    },
    [currentClient]
  );

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
      messageStore.storeMessage(messageData, address);

      return messageData;
    },
    [messageStore]
  );

  // Kasware initialization
  useEffect(() => {
    setCurrentClient(new KaspaClient());

    // (async () => {
    //   // Get network from kasware
    //   const kaswareNetwork: string | null = await window.kasware.getNetwork();

    //   // Map KasWare network to SDK network format
    //   const networkMap: Record<string, NetworkType> = {
    //     kaspa_mainnet: "mainnet",
    //     "kaspa-mainnet": "mainnet",
    //     kaspa_testnet_10: "testnet-10",
    //     "kaspa-testnet-10": "testnet-10",
    //     kaspa_testnet_11: "testnet-11",
    //     "kaspa-testnet-11": "testnet-11",
    //     kaspa_devnet: "devnet",
    //     "kaspa-devnet": "devnet",
    //   };

    //   // @TODO: proper network typing and unification
    //   const network = kaswareNetwork
    //     ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //       // @ts-ignore
    //       networkMap[kaswareNetwork]
    //     : null;
    //   if (!network) {
    //     throw new Error(`Unsupported network: ${kaswareNetwork}`);
    //   }

    //   console.log("Kaspa network selected from KasWare network:", network);
    //   setSelectedNetwork(network);
    // })();
  }, []);

  // Network change side effect
  useEffect(() => {
    console.log("Network Change Detected", selectedNetwork);
    if (!selectedNetwork) return;
    (async () => {
      // Connect to the network
      await connectToNetwork(selectedNetwork);

      const isKaswareAvailable = await checkKaswareAvailability();

      if (isKaswareAvailable) {
        console.log("KasWare Wallet is installed!");

        const network = await getKaswareCurrentNetwork();

        // propose end-user to switch their network in Kasware according to their choice on the network selector
        if (network !== selectedNetwork) {
          await switchKaswareNetwork(selectedNetwork);

          console.log("Switched KasWare network to:", selectedNetwork);
        }
      }
    })();
  }, [
    connectToNetwork,
    getKaswareCurrentNetwork,
    selectedNetwork,
    switchKaswareNetwork,
  ]);

  // @TODO instanciate everything with new internal wallet
  // Connect button handler
  const onStartMessagingProcessClicked = useCallback(async () => {
    try {
      // kasware guard
      if (!isKaswareDetected) {
        // lazily refresh kasware
        refreshKaswareDetection();
      }

      if (!currentClient || !currentClient.connected) {
        setErrorMessage(
          "Please choose a network and connect to the Kaspa Network first"
        );
        return;
      }

      if (!walletStore.unlockedWallet) {
        console.log({ walletStore });
        setErrorMessage("Please unlock your wallet first (shouldn't happen)");
        return;
      }

      // Request accounts from the Kasware wallet
      // const accounts = await window.kasware.requestAccounts();
      // console.log("Connected to Kasware Wallet:", accounts);

      // if (!accounts?.length) {
      //   console.warn("OnConnect - No account detected");
      //   return;
      // }

      // Initialize conversations immediately after connecting
      // const address = accounts[0];

      const { receiveAddress } = await walletStore.start(
        currentClient,
        walletStore.unlockedWallet
      );
      const receiveAddressStr = receiveAddress.toString();

      setSelectedAddress(receiveAddressStr);

      // await populateKaswareInformation();

      // Load existing messages and initialize contacts
      const storedMessages = messageStore.loadMessages(receiveAddressStr);
      console.log("Loaded stored messages:", storedMessages);

      // Then fetch transactions and update UI
      await fetchTransactions([receiveAddressStr]);

      // currentClient?.subscribeToUtxoChanges([address], async (notification) => {
      //   console.log("UTXO change notification received:", notification);

      //   // Wait a short moment for the transaction to be available
      //   await new Promise((resolve) => setTimeout(resolve, 2000));

      //   // Get all transactions for the address
      //   const transactions = await fetchAddressTransactions(address);
      //   console.log("Fetched transactions after UTXO change:", transactions);

      //   if (transactions && transactions.transactions) {
      //     // Load existing messages
      //     const existingMessages = messageStore.messages;
      //     const existingTxIds = new Set(
      //       existingMessages.map(
      //         (msg: { transactionId: string }) => msg.transactionId
      //       )
      //     );

      //     let hasNewMessages = false;

      //     // Process new transactions
      //     for (const tx of transactions.transactions) {
      //       // Skip if we already have this transaction
      //       if (existingTxIds.has(tx.transactionId)) {
      //         console.log("Skipping existing transaction:", tx.transactionId);
      //         continue;
      //       }

      //       if (!tx.payload) {
      //         console.log(
      //           "Skipping transaction with no payload:",
      //           tx.transactionId
      //         );
      //         continue;
      //       }

      //       console.log("Processing new transaction:", tx);
      //       hasNewMessages = true;

      //       // Process and store the new message
      //       processTransaction(tx, address);

      //       // Play notification sound
      //       const audio = new Audio(
      //         "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAkJCQkJCQkJCQkJCQkJCQwMDAwMDAwMDAwMDAwMDAwMD///////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbBE6LrOAAAAAAD/+8DEAAAJkAF59BEABGjQL3c2IgAgACAAIAMfB8H4Pg+D7/wQiCEIQhD4Pg+D4IQhCEIQh8HwfB8EIQhCEP/B8HwfBCEIQhCHwfB8HwfBCEIQhCEPg+D4PghCEIQhD4Pg+D4IQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhCHwfB8HwQhCEIQh8HwfB8EIQhCEIQ+D4Pg+CEIQhCEPg+D4PghCEIQhD4Pg+D4AAAAA"
      //       );
      //       audio.play().catch((e) => console.log("Audio play failed:", e));
      //     }

      //     if (hasNewMessages) {
      //       // Update contacts list
      //       messageStore.loadMessages(address);
      //     }
      //   }

      //   // Update balance display
      //   await populateKaswareInformation();
      // });
    } catch (error) {
      console.error("Failed to connect to Kasware Wallet:", error);

      setErrorMessage(
        `Failed to connect to Kasware Wallet: ${unknownErrorToErrorLike(error)}`
      );
    }
  }, [
    isKaswareDetected,
    setSelectedAddress,
    refreshKaswareDetection,
    populateKaswareInformation,
    messageStore,
    walletStore,
    currentClient,
  ]);

  const onContactClicked = useCallback(
    (contact: Contact) => {
      if (!selectedAddress) {
        console.error("No selected address");
        return;
      }

      messageStore.setIsCreatingNewChat(false);
      messageStore.setOpenedRecipient(contact.address);
    },
    [messageStore, selectedAddress]
  );

  const fetchTransactions = useCallback(
    async (accounts: string[]) => {
      if (!accounts || !accounts.length) return;

      try {
        const address = accounts[0];
        console.log("Fetching transactions for address:", address);

        try {
          // Get UTXO entries for the address using the correct method
          console.log("Fetching UTXO entries for address:", address);
          const utxoEntries = walletStore.getMatureUtxos();
          console.log("UTXO entries:", utxoEntries);

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
              messageStore.storeMessage(messageData, address);
            }

            // Update UI with all messages
            const allMessages = messageStore.loadMessages(address);
            console.log("All messages after processing:", allMessages);
          }

          // Update contacts list
          messageStore.loadMessages(address);

          messageStore.setIsLoaded(true);

          return transactions.transactions;
        } catch (error) {
          console.error("Error fetching data:", error);

          setErrorMessage(
            `Failed to fetch data: ${unknownErrorToErrorLike(error)}`
          );
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);

        setErrorMessage(
          `Failed to fetch transactions: ${unknownErrorToErrorLike(error)}`
        );
      }
    },
    [messageStore, walletStore]
  );

  return (
    <>
      <div className="header-container">
        <h1>Encrypted Messaging App</h1>
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={(n) => setSelectedNetwork(n)}
        />
        <div className="connection-status">{connectionStatus}</div>
      </div>
      {isWalletReady ? (
        <button onClick={onStartMessagingProcessClicked} id="connectButton">
          Start Wallet Service
        </button>
      ) : (
        <WalletGuard onSuccess={onWalletUnlocked} />
      )}
      {/* {isKaswareDetected === false ? <KaswareNotInstalled /> : null} */}
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
              <button
                onClick={onClearHistory}
                id="clearHistoryButton"
                className="clear-history-button"
              >
                Clear History
              </button>
            </div>
            <div className="messages-list">
              {messageStore.isCreatingNewChat ? (
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
            <SendMessageForm />
          </div>
        </div>
      ) : null}
      <div id="transactions">
        <WalletInfo
          state={selectedAddress ? "connected" : "detected"}
          address={selectedAddress}
          matureBalance={walletStore.balance ?? 0}
          pendingBalance={balance?.unconfirmed}
          totalBalance={balance?.total}
          utxoCount={walletStore.isAccountServiceRunning ? walletStore.getMatureUtxos()?.length ?? 0 : undefined}
          isWalletReady={isWalletReady}
        />
        <ErrorCard error={errorMessage} />
      </div>
    </>
  );
};
