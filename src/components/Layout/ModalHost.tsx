import { useUiStore } from "../../store/ui.store";
import { useWalletStore } from "../../store/wallet.store";
import { NewBroadcast } from "../Modals/NewBroadcast";
import { Modal } from "../Common/modal";
import { CopyableValueWithQR } from "../Modals/CopyableValueWithQR";
import { Wallet } from "../Modals/Wallet";
import { WalletSeedRetreiveDisplay } from "../Modals/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../Modals/WalletWithdrawal";
import { LockedSettingsModal } from "../Modals/LockedSettingsModal";
import { ContactInfoModal } from "../Modals/ContactInfoModal";
import { NewChatForm } from "../Modals/NewChatForm";
import { GroupInfoModal } from "../Modals/GroupInfoModal";
import { LoaderCircle } from "lucide-react";
import { ImagePresenter } from "../Modals/ImagePresenter";
import { BroadcastParticipantInfo } from "../Modals/BroadcastParticipantInfo";
import { GroupParticipantInfo } from "../Modals/GroupParticipantInfo";
import { QrScannerModal } from "../Modals/QrScannerModal";
import { DeleteWalletModal } from "../Modals/DeleteWalletModal";
import { useBroadcastStore } from "../../store/broadcast.store";
import { useGroupStore } from "../../store/group.store";
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
  const groupParticipant = useGroupStore(
    (state) => state.selectedGroupParticipant
  );
  const { setSelectedGroupParticipant } = useGroupStore();
  const groupInfoModalGroup = useUiStore((state) => state.groupInfoModalGroup);
  const setGroupInfoModalGroup = useUiStore(
    (state) => state.setGroupInfoModalGroup
  );

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
          <NewChatForm
            onClose={() => closeModal("new-chat")}
            initialTab="chat"
          />
        </Modal>
      )}

      {/* New Group Modal */}
      {modals["new-group"] && (
        <Modal onClose={() => closeModal("new-group")}>
          <NewChatForm
            onClose={() => closeModal("new-group")}
            initialTab="group"
          />
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
          <BroadcastParticipantInfo
            address={broadcastParticipant.address}
            nickname={broadcastParticipant.nickname}
            onClose={() => {
              closeModal("broadcast-participant-info");
              setSelectedParticipant(null);
            }}
          />
        </Modal>
      )}

      {/* Group Participant Info Modal */}
      {modals["group-participant-info"] && groupParticipant && (
        <Modal
          onClose={() => {
            closeModal("group-participant-info");
            setSelectedGroupParticipant(null);
          }}
        >
          <GroupParticipantInfo
            address={groupParticipant.address}
            nickname={groupParticipant.nickname}
            isAdmin={groupParticipant.isAdmin}
            onClose={() => {
              closeModal("group-participant-info");
              setSelectedGroupParticipant(null);
            }}
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

      {/* Group Info Modal */}
      {modals["group-info"] && groupInfoModalGroup && (
        <Modal
          onClose={() => {
            closeModal("group-info");
            setGroupInfoModalGroup(null);
          }}
        >
          <GroupInfoModal
            group={groupInfoModalGroup}
            isOpen={true}
            onClose={() => {
              closeModal("group-info");
              setGroupInfoModalGroup(null);
            }}
          />
        </Modal>
      )}
    </>
  );
};
