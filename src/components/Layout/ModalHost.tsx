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

      {/* Warning Costly Send Message Modal */}
      {modals["warn-costy-send-message"] && (
        <Modal onClose={() => closeModal("warn-costy-send-message")}>
          <div className="flex flex-col items-center justify-center gap-8">
            <h2 className="text-lg text-yellow-400">
              <AlertTriangle className="mr-2 inline size-6 text-yellow-400" />
              Your Correspondent hasn't answered yet
            </h2>

            <p className="text-center">
              Sending this message will carry an{" "}
              <span className="font-bold">extra cost of 0.2 KAS</span>, that
              will be sent to your correspondent. Are you sure you want to send
              it?
            </p>
            <div className="flex items-start justify-start rounded-lg border border-[#B6B6B6]/20 bg-gradient-to-br from-[#B6B6B6]/10 to-[#B6B6B6]/5 px-4 py-2">
              <Info className="mr-2 size-10 text-white" />
              <p className="">
                This is occuring because your correspondent hasn't accepted the
                handshake yet.
              </p>
            </div>

            <Button
              onClick={() => {
                closeModal("warn-costy-send-message");
                if (sendMessageCallback) {
                  sendMessageCallback();
                }
              }}
            >
              Send anyway
            </Button>
          </div>
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
