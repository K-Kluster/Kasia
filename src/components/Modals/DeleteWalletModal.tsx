import { FC } from "react";
import { Modal } from "../Common/modal";
import { Button } from "../Common/Button";
import { WarningBlock } from "../Common/WarningBlock";
import { useUiStore } from "../../store/ui.store";
import { useWalletStore } from "../../store/wallet.store";

interface DeleteWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteWalletModal: FC<DeleteWalletModalProps> = ({
  isOpen,
  onClose,
}) => {
  const pendingDeleteWalletId = useUiStore((s) => s.pendingDeleteWalletId);
  const setPendingDeleteWalletId = useUiStore(
    (s) => s.setPendingDeleteWalletId
  );
  const wallets = useWalletStore((s) => s.wallets);
  const deleteWallet = useWalletStore((s) => s.deleteWallet);
  const loadWallets = useWalletStore((s) => s.loadWallets);

  const wallet = pendingDeleteWalletId
    ? wallets.find((w) => w.id === pendingDeleteWalletId) || null
    : null;

  const handleConfirm = () => {
    if (pendingDeleteWalletId) {
      deleteWallet(pendingDeleteWalletId);
      loadWallets();
      setPendingDeleteWalletId(null);
    }
    onClose();
  };

  const handleCancel = () => {
    setPendingDeleteWalletId(null);
    onClose();
  };

  if (!isOpen || !wallet) return null;

  return (
    <Modal onClose={handleCancel} className="max-w-sm select-none">
      <div className="w-full p-2">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
          Delete Account
        </h2>

        <p className="mb-6 text-center text-[var(--text-secondary)] sm:text-left">
          Are you sure you want to delete the accounts{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            "{wallet.name}"
          </span>
          ?
        </p>

        <WarningBlock title="Warning" className="mb-6">
          This action cannot be undone. All account data and funds will be
          permanently removed.
        </WarningBlock>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className="flex-1 !bg-[var(--accent-red)]/80 hover:!bg-[var(--accent-red)]/70"
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
