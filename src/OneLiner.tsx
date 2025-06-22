import { FC, useCallback, useEffect, useState, useRef } from "react";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, NetworkType } from "./types/all";
import { useMessagingStore } from "./store/messaging.store";
import { WalletInfo } from "./components/WalletInfo";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { NewChatForm } from "./components/NewChatForm";
import { MessageSection } from "./containers/MessagesSection";
import { FetchApiMessages } from "./components/FetchApiMessages";
import { Bars3Icon, ArrowPathIcon } from "@heroicons/react/24/solid";
import MenuHamburger from "./components/MenuHamburger";
import { FeeBuckets } from "./components/FeeBuckets";
import { useNetworkStore } from "./store/network.store";
import { ContactSection } from "./components/ContactSection";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  const networkStore = useNetworkStore();
  const isConnected = useNetworkStore((state) => state.isConnected);
  const connect = useNetworkStore((state) => state.connect);
  // handle network error

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletInfoOpen, setIsWalletInfoOpen] = useState(false);
  const [messagesClientStarted, setMessageClientStarted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  // Network connection effect
  useEffect(() => {
    // Skip if no network selected or connection attempt in progress
    if (isConnected) {
      return;
    }

    connect();
    // this is on purpose, we only want to run this once upon component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNetworkChange = useCallback(
    (network: NetworkType) => {
      networkStore.setNetwork(network);

      // Trigger reconnection when network changes
      connect();
    },
    [connect, networkStore]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    const startMessaging = async () => {
      if (
        messagesClientStarted ||
        !isWalletReady ||
        !networkStore.isConnected ||
        !walletStore.unlockedWallet
      )
        return;
      try {
        // Start the wallet and get the receive address
        const { receiveAddress } = await walletStore.start(
        networkStore.kaspaClient
      );
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
        setMessageClientStarted(true);
      } catch (error) {
        console.error("Failed to start messaging process:", error);
        setErrorMessage(
          `Failed to start messaging: ${unknownErrorToErrorLike(error)}`
        );
      }
    };
    startMessaging();
  }, [
    networkStore.kaspaClient,
    networkStore.isConnected,
    isWalletReady,
    messageStore,
  ]); 

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
    setMessageClientStarted(false);
    setIsWalletReady(false);
    messageStore.setIsLoaded(false);
    messageStore.setOpenedRecipient(null);
    messageStore.setIsCreatingNewChat(false);
    setIsSettingsOpen(false);
    setIsWalletInfoOpen(false);
    setMessageClientStarted(false);
  };

  return (
    <div className="container">
      <div className="text-center px-8 py-1 border-b border-[var(--border-color)] relative flex items-center justify-between bg-[var(--secondary-bg)]">
        <div className="app-title flex items-center gap-2">
          <img src="/kasia-logo.png" alt="Kasia Logo" className="app-logo" />
          <h1 className="text-xl font-bold">Kasia</h1>
        </div>

        {isWalletReady && (
          <div ref={menuRef} className="relative flex items-center gap-2">
            <div className="hidden sm:block">
              <FeeBuckets inline={true} />
            </div>

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
                address={walletStore.address?.toString()}
                onCloseMenu={() => setIsSettingsOpen(false)}
                onOpenWalletInfo={() => {
                  setIsWalletInfoOpen(true);
                  setIsSettingsOpen(false);
                }}
                onCloseWallet={handleCloseWallet}
                messageStoreLoaded={messageStore.isLoaded}
              />
            ) : (
              <WalletInfo
                state={walletStore.address ? "connected" : "loading"}
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
          {!isWalletReady ? (
            <WalletGuard
              onSuccess={onWalletUnlocked}
              selectedNetwork={networkStore.network}
              onNetworkChange={onNetworkChange}
              isConnected={networkStore.isConnected}
            />
          ) : messageStore.isLoaded ? (
            <div className="bg-[var(--secondary-bg)] rounded-xl shadow-md max-w-[1200px] w-full mx-auto border border-[var(--border-color)] flex overflow-hidden min-w-[320px] h-[70vh] min-h-[300px]">
              <ContactSection
                contacts={messageStore.contacts}
                onNewChatClicked={onNewChatClicked}
                onContactClicked={onContactClicked}
                openedRecipient={messageStore.openedRecipient}
                walletAddress={walletStore.address?.toString()}
              />
              <MessageSection />
              {/* Add invisible FetchApiMessages component to listen for localStorage trigger events */}
              {walletStore.address && (
                <div style={{ display: "none" }}>
                  <FetchApiMessages address={walletStore.address.toString()} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center w-full text-xs">
              {/* If wallet is unlocked but message are not loaded, show the loading state*/}
              <div className="bg-[var(--secondary-bg)]/20 rounded-xl shadow-md max-w-[1200px] w-full mx-auto border border-[var(--border-color)] flex overflow-hidden min-w-[320px] h-[70vh] min-h-[300px] relative">
                <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col justify-center items-center space-y-4">
                  <span className="text-xl text-gray-200 font-semibold">
                    Loading Message Client
                  </span>
                  <ArrowPathIcon className="w-16 h-16 text-gray-400 animate-spin" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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
    </div>
  );
};
