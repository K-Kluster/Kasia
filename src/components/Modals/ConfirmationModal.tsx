import { FC, useEffect } from "react";
import { Modal } from "../Common/modal";
import { Button } from "../Common/Button";
import { useUiStore } from "../../store/ui.store";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmationModal: FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const confirmationConfig = useUiStore((s) => s.confirmationConfig);
  const setConfirmationConfig = useUiStore((s) => s.setConfirmationConfig);

  // Clear confirmation config when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmationConfig(null);
    }
  }, [isOpen, setConfirmationConfig]);

  const handleConfirm = () => {
    if (confirmationConfig?.onConfirm) {
      confirmationConfig.onConfirm();
    }
    setConfirmationConfig(null);
    onClose();
  };

  const handleCancel = () => {
    if (confirmationConfig?.onCancel) {
      confirmationConfig.onCancel();
    }
    setConfirmationConfig(null);
    onClose();
  };

  if (!isOpen || !confirmationConfig) return null;

  return (
    <Modal onClose={handleCancel} className="max-w-sm select-none">
      <div className="w-full p-2">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
          {confirmationConfig.title}
        </h2>

        <p className="mb-6 text-center text-[var(--text-secondary)] sm:text-left">
          {confirmationConfig.message}
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleCancel} className="flex-1">
            {confirmationConfig.cancelText || "Cancel"}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className="flex-1 !bg-[var(--accent-red)]/80 hover:!bg-[var(--accent-red)]/70"
          >
            {confirmationConfig.confirmText || "Confirm"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
