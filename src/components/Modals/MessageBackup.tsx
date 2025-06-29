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
      a.href = url;
      // Build file name with prefix, short date and short time - YYMMDD-HHMM - ty gippity for this
      a.download = `kasia-message-backup-${now
        .getFullYear()
        .toString()
        .slice(2)}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
        .getDate()
        .toString()
        .padStart(2, "0")}-${now.getHours().toString().padStart(2, "0")}${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}.json`;
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
    <div className="flex flex-col items-center justify-center space-y-2 max-w-3/4 mx-auto h-full">
      <h4 className="text-lg font-semibold">Message Backup</h4>
      <Button onClick={onExportMessages} variant="primary">
        Export Messages
      </Button>
      <label
        htmlFor="importInput"
        className={clsx(
          "cursor-pointer w-full text-gray-100 text-center font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-20 bg-emerald-500 hover:bg-emerald-500/70 active:bg-emerald-500/20"
        )}
      >
        Import Messages
      </label>

      <input
        id="importInput"
        type="file"
        accept=".json"
        onChange={onImportMessages}
        className="hidden"
      />
    </div>
  );
};
