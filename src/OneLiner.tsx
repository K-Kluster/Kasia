// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { KaspaClient } from "./utils/all-in-one";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, NetworkType } from "./types/all";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { WalletInfo } from "./components/WalletInfo";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { NewChatForm } from "./components/NewChatForm";
import styles from "./OneLiner.module.css";
import clsx from "clsx";
import { MessageSection } from "./containers/MessagesSection";
import { FetchApiMessages } from "./components/FetchApiMessages";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentClient, setCurrentClient] = useState<KaspaClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(
    "Waiting for interaction"
  );
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(
    import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet"
  );
  const [connectionAttemptInProgress, setConnectionAttemptInProgress] =
    useState(false);

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );

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

        console.log(
          `Attempting to connect to ${networkId} (type: ${typeof networkId})`
        );
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
        const needsReconnect =
          !currentClient?.connected ||
          currentClient?.networkId !== selectedNetwork;

        if (needsReconnect) {
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus(
              "Failed to establish stable connection after multiple attempts"
            );
            setIsConnected(false);
            setCurrentClient(null);
            return;
          }

          reconnectAttempts++;
          console.log(
            `Connection attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS} for ${selectedNetwork}`
          );

          // Add delay between reconnection attempts
          if (reconnectAttempts > 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, RECONNECT_DELAY)
            );
          }

          // Disconnect existing client if network changed
          if (
            currentClient?.connected &&
            currentClient.networkId !== selectedNetwork
          ) {
            console.log(
              `Disconnecting from ${currentClient.networkId} to connect to ${selectedNetwork}`
            );
            await currentClient.disconnect();
            setCurrentClient(null);
          }

          await connectToNetwork(selectedNetwork);
        } else {
          console.log(
            `Already connected to ${selectedNetwork}, no reconnection needed`
          );
          // Ensure connection state is synced with current client
          setIsConnected(true);
          setConnectionStatus(`Connected to ${selectedNetwork}`);
        }
      } catch (error) {
        console.error("Network connection error:", error);
        if (isEffectActive) {
          setConnectionStatus(
            `Connection error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          setIsConnected(false);
          setCurrentClient(null);
        }
      }
    };

    connect();

    return () => {
      isEffectActive = false;
    };
  }, [
    selectedNetwork,
    connectToNetwork,
    currentClient,
    connectionAttemptInProgress,
  ]);

  // Auto-clear connection-related errors when connection succeeds
  useEffect(() => {
    if (isConnected && connectionStatus.includes("Connected")) {
      // Clear any connection-related error messages
      if (errorMessage?.includes("WebSocket") || 
          errorMessage?.includes("RPC") || 
          errorMessage?.includes("Failed to start messaging")) {
        setErrorMessage(null);
      }
    }
  }, [isConnected, connectionStatus, errorMessage]);

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
      setErrorMessage(
        `Failed to start new chat: ${unknownErrorToErrorLike(error)}`
      );
    }
  }, [walletStore.unlockedWallet, messageStore]);

  const onStartMessagingProcessClicked = useCallback(async () => {
    try {
      // Clear any previous error messages
      setErrorMessage(null);
      
      if (!currentClient || !currentClient.connected) {
        setErrorMessage(
          "Please choose a network and connect to the Kaspa Network first"
        );
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
      
      // Check if we should trigger API message fetching for imported wallets
      const shouldFetchApi = localStorage.getItem('kasia_fetch_api_on_start');
      if (shouldFetchApi === 'true') {
        console.log('Triggering API message fetch for imported wallet...');
        // Set a flag to trigger API fetching after a short delay
        setTimeout(() => {
          const event = new CustomEvent('kasia-trigger-api-fetch', {
            detail: { address: receiveAddressStr }
          });
          window.dispatchEvent(event);
        }, 1000);
        
        // Clear the flag after use
        localStorage.removeItem('kasia_fetch_api_on_start');
      }
      
      // Clear error message on success
      setErrorMessage(null);
    } catch (error) {
      console.error("Failed to start messaging process:", error);
      setErrorMessage(
        `Failed to start messaging: ${unknownErrorToErrorLike(error)}`
      );
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
            isWalletReady={isWalletReady}
          />
        </div>
      </div>

      <div className="px-8 py-4 bg-[var(--primary-bg)]">
        <div className="flex items-center gap-4">
          {isWalletReady ? (
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full">
              <div className="flex flex-col items-start text-xs gap-1 whitespace-nowrap">
                <div>
                  <strong>Network:</strong> {walletStore.selectedNetwork}
                </div>
                <div>
                  <strong>Wallet Name:</strong> {unlockedWalletName}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  className={clsx(
                    "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer",
                    { "opacity-50 cursor-not-allowed": messageStore.isLoaded }
                  )}
                  onClick={onStartMessagingProcessClicked}
                >
                  Start Wallet Service
                </button>
                <button
                  onClick={() => {
                    walletStore.lock();
                    setIsWalletReady(false);
                    messageStore.setIsLoaded(false);
                    messageStore.setOpenedRecipient(null);
                    messageStore.setIsCreatingNewChat(false);
                  }}
                  className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer"
                >
                  Close Wallet
                </button>
              </div>
            </div>
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
                ?.filter(
                  (c) =>
                    c?.address && c.address !== walletStore.address?.toString()
                )
                .map((c) => (
                  <ContactCard
                    isSelected={c.address === messageStore.openedRecipient}
                    key={`${c.address}-${c.status || "unknown"}`}
                    contact={c}
                    onClick={onContactClicked}
                  />
                ))}
            </div>
          </div>
          <MessageSection />
          {/* Add invisible FetchApiMessages component to listen for localStorage trigger events */}
          {walletStore.address && (
            <div style={{ display: 'none' }}>
              <FetchApiMessages address={walletStore.address.toString()} />
            </div>
          )}
        </div>
      ) : null}
      <div id="transactions">
        <ErrorCard 
          error={errorMessage} 
          onDismiss={() => setErrorMessage(null)} 
        />
      </div>

      {/* Add NewChatForm when isCreatingNewChat is true */}
      {messageStore.isCreatingNewChat && (
        <div className={styles["modal-overlay"]}>
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </div>
      )}
    </div>
  );
};
