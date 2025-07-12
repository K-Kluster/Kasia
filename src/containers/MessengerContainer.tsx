import { LoaderCircle } from "lucide-react";
import { FC, useState, useEffect, useCallback } from "react";
import { Modal } from "../components/Common/modal";
import { ErrorCard } from "../components/ErrorCard";
import { MessageBackup } from "../components/Modals/MessageBackup";
import { UtxoCompound } from "../components/Modals/UtxoCompound";
import { WalletAddressSection } from "../components/Modals/WalletAddressSection";
import { WalletInfo } from "../components/Modals/WalletInfo";
import { WalletSeedRetreiveDisplay } from "../components/Modals/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../components/Modals/WalletWithdrawal";
import { NewChatForm } from "../components/NewChatForm";
import { NetworkSettingsModal } from "../components/Modals/NetworkSettingsModal";
import { useMessagingStore } from "../store/messaging.store";
import { useNetworkStore } from "../store/network.store";
import { useUiStore } from "../store/ui.store";
import { useWalletStore } from "../store/wallet.store";
import { Contact } from "../types/all";
import { unknownErrorToErrorLike } from "../utils/errors";
import { useIsMobile } from "../utils/useIsMobile";
import { ContactSection } from "./ContactSection";
import { MessageSection } from "./MessagesSection";

export const MessengerContainer: FC = () => {
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
        // On mobile, show messages if there's an opened recipient, otherwise show contacts
        if (messageStore.openedRecipient) {
          setMobileView("messages");
        } else {
          setMobileView("contacts");
        }
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
      // Called when MessagingContainer unmounts (user leaves route), so we can reset all the states
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

  // Effect to restore last opened conversation after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      !messageStore.openedRecipient &&
      messageStore.contacts.length > 0
    ) {
      const walletAddress = walletStore.address?.toString();
      if (walletAddress) {
        messageStore.restoreLastOpenedRecipient(walletAddress);
      }
    }
  }, [
    messageStore.isLoaded,
    messageStore.openedRecipient,
    messageStore.contacts.length,
    walletStore.address,
    messageStore,
    isMobile,
  ]);

  // Effect to update mobile view when opened recipient changes
  useEffect(() => {
    if (isMobile && messageStore.isLoaded) {
      if (messageStore.openedRecipient) {
        setMobileView("messages");
      } else {
        setMobileView("contacts");
      }
    }
  }, [isMobile, messageStore.openedRecipient, messageStore.isLoaded]);

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
      <div className="bg-primary-bg flex items-center">
        <div className="flex h-[100dvh] min-h-[300px] w-full overflow-hidden sm:h-[calc(100dvh-69px)]">
          {isWalletReady && messageStore.isLoaded ? (
            <>
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
            </>
          ) : isWalletReady ? (
            <div className="flex w-full flex-col items-center text-xs">
              {/* If wallet is unlocked but message are not loaded, show the loading state*/}
              <div className="border-primary-border bg-secondary-bg relative h-full w-full overflow-hidden border-t">
                <div className="bg-secondary-bg/20 absolute inset-0" />
                <div className="relative flex h-full flex-col items-center justify-center space-y-4">
                  <span className="text-sm font-medium tracking-wide text-gray-300 sm:text-lg">
                    Starting the message client...
                  </span>
                  <LoaderCircle className="h-14 w-14 animate-spin text-gray-500" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center">
              <div className="text-center">
                <p className="mb-2 text-lg font-semibold">Wallet not ready</p>
                <p className="text-sm text-gray-500">
                  Please unlock your wallet first
                </p>
              </div>
            </div>
          )}
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
              <LoaderCircle className="h-6 w-6 animate-spin text-gray-500" />
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

      {/* Settings Modal */}
      {isOpen("settings") && (
        <Modal onClose={() => closeModal("settings")}>
          <NetworkSettingsModal />
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
