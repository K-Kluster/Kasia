// this file is the legacy code that came from old codebase
// it is intended to be temporary to progressively move towards modularization

import { FC, useCallback, useEffect, useState } from "react";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, NetworkType } from "./types/all";
import { useMessagingStore } from "./store/messaging.store";
import { ContactCard } from "./components/ContactCard";
import { WalletInfo } from "./components/WalletInfo";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { NewChatForm } from "./components/NewChatForm";
import clsx from "clsx";
import { MessageSection } from "./containers/MessagesSection";
import { FetchApiMessages } from "./components/FetchApiMessages";
import { PlusIcon, Bars3Icon } from "@heroicons/react/24/solid";
import MenuHamburger from "./components/MenuHamburger";
import { FeeBuckets } from "./components/FeeBuckets";
import { WalletAddressSection } from "./components/WalletAddressSection";
import { useKaspaClient } from "./hooks/useKaspaClient";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [messageStoreLoading, setMessageStoreLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(
    import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet"
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletInfoOpen, setIsWalletInfoOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );

  const {
    client: currentClient,
    status: connectionStatus,
    isConnected,
    connect,
    disconnect,
  } = useKaspaClient(selectedNetwork, {
    onConnect: (c) => {
      walletStore.setSelectedNetwork(c.networkId);
      walletStore.setRpcClient(c);
    },
    onError: (e) => setErrorMessage(`Connection Failed: ${e.message}`),
  });

  // Auto-clear connection-related errors when connection succeeds
  useEffect(() => {
    if (isConnected && connectionStatus.includes("Connected")) {
      // Clear any connection-related error messages
      if (
        errorMessage?.includes("WebSocket") ||
        errorMessage?.includes("RPC") ||
        errorMessage?.includes("Failed to start messaging")
      ) {
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

      setMessageStoreLoading(true);

      const { receiveAddress } = await walletStore.start(currentClient);
      const receiveAddressStr = receiveAddress.toString();

      // Initialize conversation manager
      messageStore.initializeConversationManager(receiveAddressStr);

      // Load existing messages
      messageStore.loadMessages(receiveAddressStr);
      messageStore.setIsLoaded(true);

      // Check if we should trigger API message fetching for imported wallets
      const shouldFetchApi = localStorage.getItem("kasia_fetch_api_on_start");
      if (shouldFetchApi === "true") {
        console.log("Triggering API message fetch for imported wallet...");
        // Set a flag to trigger API fetching after a short delay
        setTimeout(() => {
          const event = new CustomEvent("kasia-trigger-api-fetch", {
            detail: { address: receiveAddressStr },
          });
          window.dispatchEvent(event);
        }, 1000);

        // Clear the flag after use
        localStorage.removeItem("kasia_fetch_api_on_start");
      }

      // Clear error message on success
      setErrorMessage(null);
    } catch (error) {
      console.error("Failed to start messaging process:", error);
      setErrorMessage(
        `Failed to start messaging: ${unknownErrorToErrorLike(error)}`
      );
    } finally {
      setMessageStoreLoading(false);
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
  
  const toggleSettings = () => setIsSettingsOpen((v) => !v);

  const handleCloseWallet = () => {
    walletStore.lock();
    setIsWalletReady(false);
    messageStore.setIsLoaded(false);
    messageStore.setOpenedRecipient(null);
    messageStore.setIsCreatingNewChat(false);
    setIsSettingsOpen(false);
    setIsWalletInfoOpen(false);
  };

  return (
    <div className="container">
      <div className="text-center px-8 py-1 border-b border-[var(--border-color)] relative flex items-center justify-between bg-[var(--secondary-bg)]">
        <div className="app-title flex items-center gap-2">
          <img src="/kasia-logo.png" alt="Kasia Logo" className="app-logo" />
          <h1 className="text-xl font-bold">Kasia</h1>
        </div>

        {isWalletReady && (
          <div className="relative flex items-center gap-2">
            <FeeBuckets inline={true} />

            <button
              onClick={toggleSettings}
              className="p-2 rounded hover:bg-[var(--accent-blue)]/20 focus:outline-none"
              aria-label="Settings"
            >
              <Bars3Icon className="h-6 w-6 text-white" />
            </button>

            {!isWalletInfoOpen ? (
              <MenuHamburger
                open={isSettingsOpen}
                onCloseMenu={() => setIsSettingsOpen(false)}
                onOpenWalletInfo={() => {
                  setIsWalletInfoOpen(true);
                  setIsSettingsOpen(false);
                }}
                onCloseWallet={handleCloseWallet}
              />
            ) : (
              <WalletInfo
                state={walletStore.address ? "connected" : "detected"}
                address={walletStore.address?.toString()}
                isWalletReady={isWalletReady}
                open={isWalletInfoOpen}
                onClose={() => setIsWalletInfoOpen(false)}
              />
            )}
          </div>
        )}
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
              {!messageStore.isLoaded ? (
                <div className="flex items-center gap-2 text-sm">
                  <button
                    className={clsx(
                      "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer",
                      { "opacity-50 cursor-not-allowed": messageStoreLoading }
                    )}
                    onClick={onStartMessagingProcessClicked}
                  >
                    {messageStoreLoading
                      ? "Loading..."
                      : "Start Wallet Service"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer"
                >
                  See Your Address
                </button>
              )}
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
        <div className="bg-[var(--secondary-bg)] rounded-xl shadow-md max-w-[1200px] w-full mx-auto border border-[var(--border-color)] flex overflow-hidden min-w-[320px] h-[70vh] min-h-[300px]">
          <div className="w-[200px] md:w-[280px] bg-[var(--primary-bg)] border-r border-[var(--border-color)] flex flex-col">
            <div className="px-4 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--secondary-bg)] h-[60px]">
              <div className="font-bold">Conversations</div>
              <button
                onClick={onNewChatClicked}
                className="cursor-pointer text-[#49EACB] transition-transform duration-150 ease-in-out hover:scale-110"
              >
                <PlusIcon className="size-8" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {messageStore.contacts
                ?.filter(
                  (c) =>
                    c.address && c.address !== walletStore.address?.toString()
                )
                .map((c) => (
                  <ContactCard
                    key={c.address}
                    contact={c}
                    isSelected={c.address === messageStore.openedRecipient}
                    onClick={onContactClicked}
                  />
                ))}
            </div>
          </div>
          <MessageSection />
          {/* Add invisible FetchApiMessages component to listen for localStorage trigger events */}
          {walletStore.address && (
            <div style={{ display: "none" }}>
              <FetchApiMessages address={walletStore.address.toString()} />
            </div>
          )}
        </div>
      ) : null}
      <div>
        <ErrorCard
          error={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      </div>

      {/* Add NewChatForm when isCreatingNewChat is true */}
      {messageStore.isCreatingNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </div>
      )}

      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-[var(--secondary-bg)] p-5 rounded-xl relative max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto border border-[var(--border-color)] animate-[modalFadeIn_0.3s_ease-out]">
            <WalletAddressSection address={walletStore.address?.toString()} />
            <button
              onClick={() => setIsAddressModalOpen(false)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};