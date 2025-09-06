import React, { useCallback } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { useMessagingStore } from "../../store/messaging.store";
import { Button } from "../Common/Button";
import clsx from "clsx";

export const MessageBackup: React.FC = () => {
  const walletStore = useWalletStore();
  const messageStore = useMessagingStore();

  const onExportMessages = useCallback(async () => {
    if (!walletStore.unlockedWallet?.password) {
      alert("Please unlock your wallet first");
      return;
    }

    try {
      const blob = await messageStore.exportMessages(
        walletStore.unlockedWallet,
        walletStore.unlockedWallet.password
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();

      const walletAddress = walletStore.address?.toString() || "unknown";
      const walletSuffix = walletAddress.slice(-6);
      // build file name with prefix, last 6 chars of wallet, short date and short time - YYMMDD-HHMM
      a.href = url;
      a.download = `kasia-backup-${walletSuffix}-${now
        .getFullYear()
        .toString()
        .slice(2)}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
        .getDate()
        .toString()
        .padStart(2, "0")}-${now.getHours().toString().padStart(2, "0")}${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Messages exported successfully!");
    } catch (error) {
      console.error("Error exporting messages:", error);
      alert("Failed to export messages");
    }
  }, [messageStore, walletStore.unlockedWallet]);

  const onImportMessages = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!walletStore.unlockedWallet?.password) {
        alert("Please unlock your wallet first");
        return;
      }
      try {
        await messageStore.importMessages(
          file,
          walletStore.unlockedWallet,
          walletStore.unlockedWallet.password
        );
        alert("Messages imported successfully!");
      } catch (error: unknown) {
        console.error("Error importing messages:", error);
        alert(
          error instanceof Error ? error.message : "Failed to import messages"
        );
      }

      // Clear the input
      event.target.value = "";
    },
    [messageStore, walletStore.unlockedWallet]
  );

  return (
    <div className="mx-auto flex h-full flex-col items-center justify-center space-y-2 pt-2">
      <Button onClick={onExportMessages} variant="primary">
        Export Messages
      </Button>
      <label
        htmlFor="importInput"
        className={clsx(
          "border-primary-border bg-primary-bg hover:bg-primary-bg/50 w-full cursor-pointer rounded-3xl border px-4 py-3 text-center font-bold transition-colors duration-20 sm:px-6"
        )}
      >
        Import Messages
      </label>

      <input
        id="importInput"
        type="file"
        accept=".enc"
        onChange={onImportMessages}
        className="hidden"
      />
    </div>
  );
};
