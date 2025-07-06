import { FC, useCallback, useEffect, useState, useRef } from "react";
import { unknownErrorToErrorLike } from "./utils/errors";
import { Contact } from "./types/all";
import { useMessagingStore } from "./store/messaging.store";
import { ErrorCard } from "./components/ErrorCard";
import { useWalletStore } from "./store/wallet.store";
import { NewChatForm } from "./components/NewChatForm";
import { MessageSection } from "./containers/MessagesSection";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useNetworkStore } from "./store/network.store";
import { ContactSection } from "./containers/ContactSection";
import { useIsMobile } from "./utils/useIsMobile";
import { Modal } from "./components/Common/modal";
import { WalletAddressSection } from "./components/Modals/WalletAddressSection";
import { WalletWithdrawal } from "./components/Modals/WalletWithdrawal";
import { WalletSeedRetreiveDisplay } from "./components/Modals/WalletSeedRetreiveDisplay";
import { MessageBackup } from "./components/Modals/MessageBackup";
import { WalletInfo } from "./components/Modals/WalletInfo";
import { UtxoCompound } from "./components/Modals/UtxoCompound";
import { useUiStore } from "./store/ui.store";

export const OneLiner: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const uiStore = useUiStore();

  const networkStore = useNetworkStore();
  const [messagesClientStarted, setMessageClientStarted] = useState(false);
  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"contacts" | "messages">(
    "contacts"
  );

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const isMobile = useIsMobile();
  const { isOpen, closeModal, closeAllModals } = useUiStore();

  useEffect(() => {
    if (walletStore.unlockedWallet) setIsWalletReady(true);
  }, [walletStore.unlockedWallet]);

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
  }, [contactsCollapsed, messageStore.openedRecipient, isMobile]);

  // Clean up useEffect
  useEffect(() => {
    return () => {
      // Called when OneLiner unmounts (user leaves route), so we can reset all the states
      walletStore.lock();
      uiStore.setSettingsOpen(false);
      closeAllModals();

      setMessageClientStarted(false);
      messageStore.setIsLoaded(false);
      messageStore.setOpenedRecipient(null);
      messageStore.setIsCreatingNewChat(false);
    };
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
        const receiveAddress =
          walletStore.unlockedWallet.publicKeyGenerator.receiveAddress(
            networkStore.network,
            0
          );

        const receiveAddressStr = receiveAddress.toString();

        // Initialize conversation manager
        messageStore.initializeConversationManager(receiveAddressStr);

        // Start the wallet and get the receive address
        await walletStore.start(networkStore.kaspaClient);

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
  }, [isWalletReady, networkStore.isConnected, walletStore.unlockedWallet]);

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
    <>
      {/* Main Message Section*/}
      <div className="bg-[var(--primary-bg)] sm:px-8 sm:py-4">
        <div className="flex items-center gap-4">
          {isWalletReady &&
            (isWalletReady && messageStore.isLoaded ? (
              <div className="flex h-[100vh] min-h-[300px] w-full min-w-[320px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--secondary-bg)] shadow-md sm:mx-auto sm:h-[85vh] sm:max-w-[1200px]">
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
                />
                <MessageSection
                  mobileView={mobileView}
                  setMobileView={setMobileView}
                />
              </div>
            ) : (
              <div className="flex w-full flex-col items-center text-xs">
                {/* If wallet is unlocked but message are not loaded, show the loading state*/}
                <div className="relative mx-auto h-[100vh] min-h-[300px] w-full min-w-[320px] overflow-hidden rounded-xl border border-[var(--border-color)] shadow-md sm:h-[85vh] sm:max-w-[1200px]">
                  <div className="absolute inset-0 animate-pulse bg-[var(--secondary-bg)]/20" />
                  <div className="relative flex h-full flex-col items-center justify-center space-y-4">
                    <span className="text-sm font-medium tracking-wide text-gray-300 sm:text-lg">
                      Starting the message client...
                    </span>
                    <ArrowPathIcon className="h-14 w-14 animate-spin text-gray-500" />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
      {/* Global Error Section*/}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />

      {/* Address Modal */}
      {isOpen("address") && (
        <Modal onClose={() => closeModal("address")}>
          {walletStore.address ? (
            <WalletAddressSection address={walletStore.address.toString()} />
          ) : (
            <div className="flex justify-center py-6">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
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

      {/* UTXO Compound Modal */}
      {isOpen("utxo-compound") && (
        <Modal onClose={() => closeModal("utxo-compound")}>
          <UtxoCompound />
        </Modal>
      )}

      {/* Wallet Info Modal */}
      {isOpen("walletInfo") && (
        <Modal onClose={() => closeModal("walletInfo")}>
          <WalletInfo />
        </Modal>
      )}

      {/* Start New Conversation Modal */}
      {messageStore.isCreatingNewChat && (
        <Modal onClose={() => messageStore.setIsCreatingNewChat(false)}>
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </Modal>
      )}
    </>
  );
};
