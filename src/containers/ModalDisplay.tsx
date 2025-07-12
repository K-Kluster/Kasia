import { useUiStore } from "../store/ui.store";
import { useWalletStore } from "../store/wallet.store";
import { useMessagingStore } from "../store/messaging.store";
import { Modal } from "../components/Common/modal";
import { MessageBackup } from "../components/Modals/MessageBackup";
import { UtxoCompound } from "../components/Modals/UtxoCompound";
import { WalletAddressSection } from "../components/Modals/WalletAddressSection";
import { WalletInfo } from "../components/Modals/WalletInfo";
import { WalletSeedRetreiveDisplay } from "../components/Modals/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../components/Modals/WalletWithdrawal";
import { NewChatForm } from "../components/NewChatForm";
import { LoaderCircle } from "lucide-react";
import { ContactInfoModal } from "../components/Modals/ContactInfoModal";

export const ModalDisplay = () => {
  const isOpen = useUiStore((s) => s.isOpen);
  const closeModal = useUiStore((s) => s.closeModal);
  const contactInfoContact = useUiStore((s) => s.contactInfoContact);
  const setContactInfoContact = useUiStore((s) => s.setContactInfoContact);
  const walletStore = useWalletStore();
  const messageStore = useMessagingStore();

  return (
    <>
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
      {isOpen("withdraw") && (
        <Modal onClose={() => closeModal("withdraw")}>
          <WalletWithdrawal />
        </Modal>
      )}
      {isOpen("backup") && (
        <Modal onClose={() => closeModal("backup")}>
          <MessageBackup />
        </Modal>
      )}
      {isOpen("seed") && (
        <Modal onClose={() => closeModal("seed")}>
          <WalletSeedRetreiveDisplay />
        </Modal>
      )}
      {isOpen("utxo-compound") && (
        <Modal onClose={() => closeModal("utxo-compound")}>
          <UtxoCompound />
        </Modal>
      )}
      {isOpen("walletInfo") && (
        <Modal onClose={() => closeModal("walletInfo")}>
          <WalletInfo />
        </Modal>
      )}
      {messageStore.isCreatingNewChat && (
        <Modal onClose={() => messageStore.setIsCreatingNewChat(false)}>
          <NewChatForm
            onClose={() => messageStore.setIsCreatingNewChat(false)}
          />
        </Modal>
      )}
      {isOpen("contact-info-modal") && contactInfoContact && (
        <Modal
          onClose={() => {
            closeModal("contact-info-modal");
            setContactInfoContact(null);
          }}
        >
          <ContactInfoModal
            contact={contactInfoContact}
            onClose={() => {
              closeModal("contact-info-modal");
              setContactInfoContact(null);
            }}
          />
        </Modal>
      )}
    </>
  );
};
