import { useUiStore } from "../../store/ui.store";
import { useWalletStore } from "../../store/wallet.store";
import { NewBroadcast } from "../Modals/NewBroadcast";
import { Modal } from "../Common/modal";
import { CopyableValueWithQR } from "../Modals/CopyableValueWithQR";
import { Wallet } from "../Modals/Wallet";
import { WalletSeedRetreiveDisplay } from "../Modals/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../Modals/WalletWithdrawal";
import { LockedSettingsModal } from "../Modals/LockedSettingsModal";
import { SettingsModal } from "../Modals/SettingsModal";
import { ContactInfoModal } from "../Modals/ContactInfoModal";
import { NewChatForm } from "../Modals/NewChatForm";
import { LoaderCircle } from "lucide-react";
import { ImagePresenter } from "../Modals/ImagePresenter";
import { BroadcastParticipantInfoModal } from "../Modals/BroadcastParticipantInfoModal";
import { QrScannerModal } from "../Modals/QrScannerModal";
import { DeleteWalletModal } from "../Modals/DeleteWalletModal";
import { ConfirmationModal } from "../Modals/ConfirmationModal";
import { useBroadcastStore } from "../../store/broadcast.store";
import { KASPA_DONATION_ADDRESS } from "../../config/constants";

// This component subscribes to modal state and renders the appropriate modal
// based on the current state. It's React Compiler friendly because it has
// explicit dependencies on the modal state.

export const ModalHost = () => {
  // this is the line that makes us aware of store state!
  const modals = useUiStore((state) => state.modals);
  const closeModal = useUiStore((state) => state.closeModal);
  const oneOnOneConversation = useUiStore((s) => s.oneOnOneConversation);
  const setOneOnOneConversation = useUiStore((s) => s.setOneOnOneConversation);
  const walletStore = useWalletStore();
  const broadcastParticipant = useBroadcastStore(
    (state) => state.selectedParticipant
  );
  const { setSelectedParticipant } = useBroadcastStore();

  return (
    <>
      {/* Donation Modal */}
      {modals.donation && (
        <Modal onClose={() => closeModal("donation")}>
          <CopyableValueWithQR
            value={KASPA_DONATION_ADDRESS}
            label={"Kasia Dev-fund:"}
            qrTitle="Thanks for Supporting Us!"
          />
        </Modal>
      )}
      {/* Address Modal */}
      {modals.address && (
        <Modal onClose={() => closeModal("address")}>
          {walletStore.address ? (
            <CopyableValueWithQR
              value={walletStore.address.toString()}
              label={"Address:"}
              qrTitle="QR Code for Address"
            />
          ) : (
            <div className="flex justify-center py-6">
              <LoaderCircle className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          )}
        </Modal>
      )}

      {/* View Image */}
      {modals.image && <ImagePresenter onClose={() => closeModal("image")} />}
      {/* Withdraw Modal */}
      {modals.withdraw && (
        <Modal onClose={() => closeModal("withdraw")}>
          <WalletWithdrawal />
        </Modal>
      )}

      {/* Seed Modal */}
      {modals.seed && (
        <Modal onClose={() => closeModal("seed")}>
          <WalletSeedRetreiveDisplay />
        </Modal>
      )}

      {/* Wallet Info Modal */}
      {modals.walletInfo && (
        <Modal onClose={() => closeModal("walletInfo")}>
          <Wallet />
        </Modal>
      )}

      {/* Settings Modal (previously in WalletFlow) */}
      {modals.settings && (
        <Modal onClose={() => closeModal("settings")}>
          <LockedSettingsModal />
        </Modal>
      )}

      {/* Unlocked Settings Modal */}
      {modals["settings-unlocked"] && (
        <SettingsModal
          isOpen={true}
          onClose={() => closeModal("settings-unlocked")}
        />
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

      {/* New Chat Form Modal */}
      {modals["new-chat"] && (
        <Modal onClose={() => closeModal("new-chat")}>
          <NewChatForm onClose={() => closeModal("new-chat")} />
        </Modal>
      )}

      {/* New brocast channel */}
      {modals["new-broadcast"] && (
        <Modal onClose={() => closeModal("new-broadcast")}>
          <NewBroadcast onClose={() => closeModal("new-broadcast")} />
        </Modal>
      )}

      {/* Broadcast Participant Info Modal */}
      {modals["broadcast-participant-info"] && broadcastParticipant && (
        <Modal
          onClose={() => {
            closeModal("broadcast-participant-info");
            setSelectedParticipant(null);
          }}
        >
          <BroadcastParticipantInfoModal
            address={broadcastParticipant.address}
            nickname={broadcastParticipant.nickname}
          />
        </Modal>
      )}

      {/* QR Scanner Modal */}
      {modals["qr-scanner"] && <QrScannerModal />}

      {/* Delete Wallet Modal */}
      {modals.delete && (
        <DeleteWalletModal
          isOpen={modals.delete || false}
          onClose={() => closeModal("delete")}
        />
      )}

      {/* Confirmation Modal */}
      {modals.confirm && (
        <ConfirmationModal
          isOpen={modals.confirm || false}
          onClose={() => closeModal("confirm")}
        />
      )}
    </>
  );
};
