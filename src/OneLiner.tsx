// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { KaspaClient } from "./utils/all-in-one";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, Message, NetworkType } from "./type/all";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { MessageDisplay } from "./components/MessageDisplay";
import { WalletInfo } from "./components/WalletInfo";
import { SendMessageForm } from "./containers/SendMessageForm";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { FetchApiMessages } from "./components/FetchApiMessages";
import { NewChatForm } from './components/NewChatForm';
import styles from './OneLiner.module.css';

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentClient, setCurrentClient] = useState<KaspaClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Waiting for interaction");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("mainnet");
  const [connectionAttemptInProgress, setConnectionAttemptInProgress] = useState(false);

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const connectToNetwork = useCallback(
    async (networkId: NetworkType) => {
      // Skip if already attempting connection
      if (connectionAttemptInProgress) {
        console.log("Connection attempt already in progress, skipping");
        return;
      }

      setConnectionAttemptInProgress(true);

      try {
        setConnectionStatus("Connecting...");
        setIsConnected(false);

        // Disconnect existing client if any
        if (currentClient?.connected) {
          console.log("Disconnecting existing client");
          await currentClient.disconnect();
          setCurrentClient(null);
        }

        console.log(`Attempting to connect to ${networkId} (type: ${typeof networkId})`);
        const client = new KaspaClient(networkId);

        // Try to connect
        console.log("Calling connect() on KaspaClient...");
        await client.connect();
        console.log("Connect() call completed");
        
        if (client.connected) {
          console.log(`Successfully connected to ${networkId}`);
          setCurrentClient(client);
          setIsConnected(true);
          setConnectionStatus(`Connected to ${networkId}`);
          walletStore.setSelectedNetwork(networkId);
          // Update the RPC client in the wallet store
          walletStore.setRpcClient(client);
        } else {
          console.log(`Failed to connect to ${networkId}`);
          setIsConnected(false);
          setConnectionStatus("Connection Failed");
          setCurrentClient(null);
          // Clear the RPC client in the wallet store
          walletStore.setRpcClient(null);
        }
      } catch (error) {
        console.error("Failed to connect:", error);
        setIsConnected(false);
        setCurrentClient(null);
        if (error instanceof Error) {
          setConnectionStatus(`Connection Failed: ${error.message}`);
        } else {
          setConnectionStatus("Connection Failed: Unknown error");
        }
      } finally {
        setConnectionAttemptInProgress(false);
      }
    },
    [currentClient, walletStore, connectionAttemptInProgress]
  );

  // Network connection effect
  useEffect(() => {
    // Skip if no network selected or connection attempt in progress
    if (!selectedNetwork || connectionAttemptInProgress) {
      return;
    }

    let isEffectActive = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 1000; // 1 second delay between attempts

    const connect = async () => {
      try {
        if (!isEffectActive) return;

        // Check if we need to reconnect
        const needsReconnect = !currentClient?.connected || 
                             currentClient?.networkId !== selectedNetwork;

        if (needsReconnect) {
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus("Failed to establish stable connection after multiple attempts");
            setIsConnected(false);
            setCurrentClient(null);
            return;
          }

          reconnectAttempts++;
          console.log(`Connection attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS} for ${selectedNetwork}`);
          
          // Add delay between reconnection attempts
          if (reconnectAttempts > 1) {
            await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
          }

          // Disconnect existing client if network changed
          if (currentClient?.connected && currentClient.networkId !== selectedNetwork) {
            console.log(`Disconnecting from ${currentClient.networkId} to connect to ${selectedNetwork}`);
            await currentClient.disconnect();
            setCurrentClient(null);
          }

          await connectToNetwork(selectedNetwork);
        } else {
          console.log(`Already connected to ${selectedNetwork}, no reconnection needed`);
          // Ensure connection state is synced with current client
          setIsConnected(true);
          setConnectionStatus(`Connected to ${selectedNetwork}`);
        }
      } catch (error) {
        console.error("Network connection error:", error);
        if (isEffectActive) {
          setConnectionStatus(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsConnected(false);
          setCurrentClient(null);
        }
      }
    };

    connect();

    return () => {
      isEffectActive = false;
    };
  }, [selectedNetwork, connectToNetwork, currentClient, connectionAttemptInProgress]);

  const onWalletUnlocked = useCallback(() => {
    setIsWalletReady(true);
  }, []);

  const onNewChatClicked = useCallback(async () => {
    try {
      if (!walletStore.unlockedWallet?.password) {
        setErrorMessage("Please unlock your wallet first");
        return;
      }

    messageStore.setIsCreatingNewChat(true);

      // The UI should now show a form to enter recipient address
      // When address is entered, it will call initiateHandshake
    } catch (error) {
      console.error("Failed to start new chat:", error);
      setErrorMessage(`Failed to start new chat: ${unknownErrorToErrorLike(error)}`);
    }
  }, [walletStore.unlockedWallet, messageStore]);

  const onClearHistory = useCallback(() => {
    if (!walletStore.address) {
      return;
    }

    if (confirm("Are you sure you want to clear all message history? This cannot be undone.")) {
      messageStore.flushCache(walletStore.address.toString());
    }
  }, [walletStore.address, messageStore]);

  const onExportMessages = useCallback(async () => {
    if (!walletStore.unlockedWallet?.password) {
      alert("Please unlock your wallet first");
      return;
    }

    try {
      const blob = await messageStore.exportMessages(
        walletStore.unlockedWallet,
        walletStore.unlockedWallet.password
      );
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kaspa-messages-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting messages:", error);
      alert("Failed to export messages");
    }
  }, [messageStore, walletStore.unlockedWallet]);

  const onImportMessages = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!walletStore.unlockedWallet?.password) {
      alert("Please unlock your wallet first");
      return;
    }

    try {
      await messageStore.importMessages(
        file, 
        walletStore.unlockedWallet,
        walletStore.unlockedWallet.password
      );
      alert("Messages imported successfully!");
    } catch (error: unknown) {
      console.error("Error importing messages:", error);
      alert(error instanceof Error ? error.message : "Failed to import messages");
    }
    
    // Clear the input
    event.target.value = '';
  }, [messageStore, walletStore.unlockedWallet]);

  const onStartMessagingProcessClicked = useCallback(async () => {
    try {
      if (!currentClient || !currentClient.connected) {
        setErrorMessage("Please choose a network and connect to the Kaspa Network first");
        return;
      }

      if (!walletStore.unlockedWallet) {
        setErrorMessage("Please unlock your wallet first");
        return;
      }

      const { receiveAddress } = await walletStore.start(currentClient);
      const receiveAddressStr = receiveAddress.toString();

      // Initialize conversation manager
      messageStore.initializeConversationManager(receiveAddressStr);

      // Load existing messages
      messageStore.loadMessages(receiveAddressStr);
      messageStore.setIsLoaded(true);

    } catch (error) {
      console.error("Failed to start messaging process:", error);
      setErrorMessage(`Failed to start messaging: ${unknownErrorToErrorLike(error)}`);
    }
  }, [currentClient, walletStore, messageStore]);

  const onContactClicked = useCallback(
    (contact: Contact) => {
      if (!walletStore.address) {
        console.error("No wallet address");
        return;
      }

      messageStore.setIsCreatingNewChat(false);
      messageStore.setOpenedRecipient(contact.address);
    },
    [messageStore, walletStore.address]
  );

  // Add function to handle handshake initiation
  const initiateHandshakeWithRecipient = useCallback(async (recipientAddress: string) => {
    try {
      if (!walletStore.unlockedWallet?.password) {
        throw new Error("Wallet must be unlocked");
      }

      // Initiate handshake and get payload
      const { payload, conversation } = await messageStore.initiateHandshake(recipientAddress);

      // Create and send transaction with handshake payload
      // You'll need to implement the actual transaction sending here
      // This might involve using your existing transaction creation methods

      messageStore.setIsCreatingNewChat(false);
    } catch (error) {
      console.error("Failed to initiate handshake:", error);
      setErrorMessage(`Failed to initiate handshake: ${unknownErrorToErrorLike(error)}`);
    }
  }, [walletStore.unlockedWallet, messageStore]);

  return (
    <div className="container">
      <div className="header-container">
        <div className="app-title">
          <img src="/kasia-logo.png" alt="Kasia Logo" className="app-logo" />
          <h1>Kasia</h1>
        </div>

        <div className="header-right">
          <WalletInfo
            state={walletStore.address ? "connected" : "detected"}
            address={walletStore.address?.toString()}
            balance={walletStore.balance}
            isWalletReady={isWalletReady}
          />
        </div>
      </div>

      <div className="wallet-controls">
        <div className="wallet-controls-left">
          {isWalletReady ? (
            <>
              <button onClick={onStartMessagingProcessClicked} id="connectButton">
                Start Wallet Service
              </button>
              <button onClick={() => {
                walletStore.lock();
                setIsWalletReady(false);
                messageStore.setIsLoaded(false);
                messageStore.setOpenedRecipient(null);
                messageStore.setIsCreatingNewChat(false);
              }} className="close-wallet-button">
                Close Wallet
              </button>
            </>
          ) : (
            <WalletGuard 
              onSuccess={onWalletUnlocked} 
              selectedNetwork={selectedNetwork}
              onNetworkChange={setSelectedNetwork}
              isConnected={isConnected}
            />
          )}
        </div>
      </div>

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
              {messageStore.contacts
                ?.filter(c => c?.address && c.address !== walletStore.address?.toString())
                .map((c) => (
                  <ContactCard
                    isSelected={c.address === messageStore.openedRecipient}
                    key={`${c.address}-${c.status || 'unknown'}`}
                    contact={c}
                    onClick={onContactClicked}
                  />
                ))}
            </div>
          </div>
          <div className="messages-section">
            <div className="messages-header">
              <h3>Messages</h3>
              <div className="header-actions">
                {walletStore.address && <FetchApiMessages address={walletStore.address.toString()} />}
                <button
                  onClick={onExportMessages}
                  className="backup-button"
                  title="Export message backup"
                >
                  Export Backup
                </button>
                <label className="import-button" title="Import message backup">
                  Import Backup
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={onImportMessages}
                  />
                </label>
                <button
                  onClick={onClearHistory}
                  id="clearHistoryButton"
                  className="clear-history-button"
                >
                  Clear History
                </button>
              </div>
            </div>
            <div 
              className="messages-list" 
              ref={(el) => {
                // Auto-scroll to bottom when new messages arrive
                if (el) {
                  el.scrollTop = el.scrollHeight;
                }
              }}
            >
              {messageStore.isCreatingNewChat ? (
                <div className="no-messages">
                  Enter a recipient address to start a new conversation.
                </div>
              ) : messageStore.messagesOnOpenedRecipient.length ? (
                messageStore.messagesOnOpenedRecipient.map((msg) => (
                  <MessageDisplay
                    isOutgoing={msg.senderAddress === walletStore.address?.toString()}
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
        <ErrorCard error={errorMessage} />
      </div>

      {/* Add NewChatForm when isCreatingNewChat is true */}
      {messageStore.isCreatingNewChat && (
        <div className={styles['modal-overlay']}>
          <NewChatForm onClose={() => messageStore.setIsCreatingNewChat(false)} />
        </div>
      )}
    </div>
  );
};
