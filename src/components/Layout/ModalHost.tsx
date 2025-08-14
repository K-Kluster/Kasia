import { useUiStore } from "../../store/ui.store";
import { useWalletStore } from "../../store/wallet.store";
import { useMessagingStore } from "../../store/messaging.store";
import { Modal } from "../Common/modal";
import { MessageBackup } from "../Modals/MessageBackup";
import { UtxoCompound } from "../Modals/UtxoCompound";
import { WalletAddressSection } from "../Modals/WalletAddressSection";
import { WalletInfo } from "../Modals/WalletInfo";
import { WalletSeedRetreiveDisplay } from "../Modals/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../Modals/WalletWithdrawal";
import { LockedSettingsModal } from "../Modals/LockedSettingsModal";
import { ContactInfoModal } from "../Modals/ContactInfoModal";
import { NewChatForm } from "../NewChatForm";
import { LoaderCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "../Common/Button";
import { ImagePresenter } from "../Modals/ImagePresenter";

// This component subscribes to modal state and renders the appropriate modal
// based on the current state. It's React Compiler friendly because it has
// explicit dependencies on the modal state.

export const ModalHost = () => {
  // this is the line that makes us aware of store state!
  const modals = useUiStore((state) => state.modals);
  const closeModal = useUiStore((state) => state.closeModal);
  const oneOnOneConversation = useUiStore((s) => s.oneOnOneConversation);
  const setOneOnOneConversation = useUiStore((s) => s.setOneOnOneConversation);
  const sendMessageCallback = useUiStore((state) => state.sendMessageCallback);

  const walletStore = useWalletStore();
  const messageStore = useMessagingStore();

  return (
    <>
      {/* Address Modal */}
      {modals.address && (
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

      {/* View Image */}
      {modals.image && (
        <Modal onClose={() => closeModal("image")}>
          <ImagePresenter />
        </Modal>
      )}
      {/* Withdraw Modal */}
      {modals.withdraw && (
        <Modal onClose={() => closeModal("withdraw")}>
          <WalletWithdrawal />
        </Modal>
      )}

      {/* Backup Modal */}
      {modals.backup && (
        <Modal onClose={() => closeModal("backup")}>
          <MessageBackup />
        </Modal>
      )}

      {/* Seed Modal */}
      {modals.seed && (
        <Modal onClose={() => closeModal("seed")}>
          <WalletSeedRetreiveDisplay />
        </Modal>
      )}

      {/* UTXO Compound Modal */}
      {modals["utxo-compound"] && (
        <Modal onClose={() => closeModal("utxo-compound")}>
          <UtxoCompound />
        </Modal>
      )}

      {/* Wallet Info Modal */}
      {modals.walletInfo && (
        <Modal onClose={() => closeModal("walletInfo")}>
          <WalletInfo />
        </Modal>
      )}

      {/* Settings Modal (previously in WalletFlow) */}
      {modals.settings && (
        <Modal onClose={() => closeModal("settings")}>
          <LockedSettingsModal />
        </Modal>
      )}

      {/* Contact Info Modal */}
      {modals["contact-info-modal"] && oneOnOneConversation && (
        <Modal
          onClose={() => {
            closeModal("contact-info-modal");
            setOneOnOneConversation(null);
          }}
        >
          <ContactInfoModal
            oooc={oneOnOneConversation}
            onClose={() => {
              closeModal("contact-info-modal");
              setOneOnOneConversation(null);
            }}
          />
        </Modal>
      )}

      {/* New Chat Form Modal (from messaging store) */}
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
