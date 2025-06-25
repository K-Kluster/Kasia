import { FC, useCallback, useEffect, useState, useRef } from "react";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact, NetworkType } from "./types/all";
import { useMessagingStore } from "./store/messaging.store";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { WalletGuard } from "./containers/WalletGuard";
import { NewChatForm } from "./components/NewChatForm";
import { MessageSection } from "./containers/MessagesSection";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useNetworkStore } from "./store/network.store";
import { ContactSection } from "./components/ContactSection";
import { Header } from "./components/Layout/Header";
import { useIsMobile } from "./utils/useIsMobile";
import { SlideOutMenu } from "./components/Layout/SlideOutMenu";
import { useModals} from "./context/ModalContext";
import { Modal } from "./components/Common/modal";
import { WalletAddressSection } from "./components/Modals/WalletAddressSection";
import { WalletWithdrawal } from "./components/Modals/WalletWithdrawal";
import { WalletSeedRetreiveDisplay } from "./components/Modals/WalletSeedRetreiveDisplay";
import { MessageBackup } from "./components/Modals/MessageBackup";
import { WalletInfo } from "./components/Modals/WalletInfo";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  const networkStore = useNetworkStore();
  const isConnected = useNetworkStore((state) => state.isConnected);
  const connect = useNetworkStore((state) => state.connect);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletInfoOpen, setIsWalletInfoOpen] = useState(false);
  const [messagesClientStarted, setMessageClientStarted] = useState(false);
  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"contacts" | "messages">(
    "contacts"
  );

  const menuRef = useRef<HTMLDivElement>(null);

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const toggleSettings = () => setIsSettingsOpen((v) => !v);
  const isMobile = useIsMobile();

  const { isOpen, closeModal } = useModals();
  


  // Effect to handle if you drag from desktop to mobile, we need the mobile view to be aware!
  useEffect(() => {
    const syncToWidth = () => {
      if (isMobile) {
        if (contactsCollapsed) setContactsCollapsed(false);
        if (!messageStore.openedRecipient) setMobileView("contacts");
      } else {
        setMobileView("contacts");
      }
    };

    syncToWidth(); // run once on mount
    window.addEventListener("resize", syncToWidth);
    return () => window.removeEventListener("resize", syncToWidth);
  }, [contactsCollapsed, messageStore.openedRecipient]);

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
    const startMessageClient = async () => {
      if (
        messagesClientStarted ||
        !isWalletReady ||
        !networkStore.isConnected ||
        !walletStore.unlockedWallet ||
        !networkStore.kaspaClient
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
    startMessageClient();
  }, [isWalletReady, messageStore]);

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

  const handleCloseWallet = () => {
    walletStore.lock();
    setIsWalletReady(false);
    messageStore.setIsLoaded(false);
    messageStore.setOpenedRecipient(null);
    messageStore.setIsCreatingNewChat(false);
    setIsSettingsOpen(false);
    setIsWalletInfoOpen(false);
  };

  // if we disconnect or something including or other than a graceful close, still kill the messaging client
  useEffect(() => {
    if (!isWalletReady || !walletStore.unlockedWallet) {
      setMessageClientStarted(false);
    }
  }, [isWalletReady, walletStore.unlockedWallet]);

  return (
    <>
      {/* Top Bar / Header */}
      {!isMobile && (
        <Header
          isWalletReady={isWalletReady}
          walletAddress={walletStore.address?.toString()}
          isSettingsOpen={isSettingsOpen}
          isWalletInfoOpen={isWalletInfoOpen}
          menuRef={menuRef}
          toggleSettings={toggleSettings}
          onCloseWallet={handleCloseWallet}
          setIsWalletInfoOpen={setIsWalletInfoOpen}
          setIsSettingsOpen={setIsSettingsOpen}
        />
      )}
      {isMobile && isSettingsOpen && (
        <SlideOutMenu
          open={isSettingsOpen}
          address={walletStore.address?.toString()}
          onClose={() => setIsSettingsOpen(false)}
          isWalletInfoOpen={isWalletInfoOpen}
          onOpenWalletInfo={() => setIsWalletInfoOpen(true)}
          isWalletReady={isWalletReady}
          onCloseWallet={handleCloseWallet}
        />
      )}

      {/* Main Message Section*/}
      <div className="px-1 sm:px-8 py-4 bg-[var(--primary-bg)]">
        <div className="flex items-center gap-4">
          {!isWalletReady ? (
            <WalletGuard
              onSuccess={onWalletUnlocked}
              selectedNetwork={networkStore.network}
              onNetworkChange={onNetworkChange}
              isConnected={networkStore.isConnected}
            />
          ) : messageStore.isLoaded ? (
            <div
              className="
              bg-[var(--secondary-bg)] rounded-xl shadow-md max-w-[1200px] w-full mx-auto
              border border-[var(--border-color)] overflow-hidden min-w-[320px] h-[85vh] min-h-[300px]
              flex
            "
            >
              <ContactSection
                contacts={messageStore.contacts}
                onNewChatClicked={onNewChatClicked}
                onContactClicked={onContactClicked}
                openedRecipient={messageStore.openedRecipient}
                walletAddress={walletStore.address?.toString()}
                mobileView={mobileView}
                contactsCollapsed={contactsCollapsed}
                setContactsCollapsed={setContactsCollapsed}
                setMobileView={setMobileView}
                onOpenMobileMenu={() => setIsSettingsOpen(true)}
              />
              <MessageSection
                mobileView={mobileView}
                setMobileView={setMobileView}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center w-full text-xs">
              {/* If wallet is unlocked but message are not loaded, show the loading state*/}
              <div className="relative max-w-[1200px] w-full mx-auto min-w-[320px] h-[85vh] min-h-[300px] overflow-hidden rounded-xl border border-[var(--border-color)] shadow-md">
                <div className="absolute inset-0 bg-[var(--secondary-bg)]/20 animate-pulse" />
                <div className="relative flex flex-col items-center justify-center h-full space-y-4">
                  <span className="text-sm sm:text-lg text-gray-300 font-medium tracking-wide">
                    Connecting message client...
                  </span>
                  <ArrowPathIcon className="w-14 h-14 text-gray-500 animate-spin" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Global Error Section*/}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />

      {/* Address Modal (triggered via openModal("address")) */}
      {isOpen("address") && (
        <Modal onClose={() => closeModal("address")}>
          {walletStore.address ? (
            <WalletAddressSection address={walletStore.address.toString()} />
          ) : (
            <div className="flex justify-center py-6">
              <ArrowPathIcon className="animate-spin h-6 w-6 text-gray-500" />
            </div>
          )}
        </Modal>
      )}

      {/* Address Modal */}
      {isOpen("address") && (
        <Modal onClose={() => closeModal("address")}>
          {walletStore.address ? (
            <WalletAddressSection address={walletStore.address.toString()} />
          ) : (
            <div className="flex justify-center py-6">
              <ArrowPathIcon className="animate-spin h-6 w-6 text-gray-500" />
            </div>
          )}
        </Modal>
      )}

      {/* Withdraw Modal */}
      {isOpen("withdraw") && (
        <Modal onClose={() => closeModal("withdraw")}>
          <WalletWithdrawal />
        </Modal>
      )}

      {/* Backup Modal */}
      {isOpen("backup") && (
        <Modal onClose={() => closeModal("backup")}>
          <MessageBackup />
        </Modal>
      )}

      {/* Seed Modal */}
      {isOpen("seed") && (
        <Modal onClose={() => closeModal("seed")}>
          <WalletSeedRetreiveDisplay />
        </Modal>
      )}

      {/* Wallet Info Modal */}
      {/* Wallet Info Modal */}
      {isOpen("walletInfo") &&
         (
          <Modal onClose={() => closeModal("walletInfo")}>
            <WalletInfo
            />
          </Modal>
        )}

      {/* Start New Conversation Modal */}
      {messageStore.isCreatingNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </div>
      )}
    </>
  );
};
