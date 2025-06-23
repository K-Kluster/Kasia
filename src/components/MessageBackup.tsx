import React, { useCallback } from "react"
import { useWalletStore } from "../store/wallet.store"
import { useMessagingStore } from "../store/messaging.store"

export const MessageBackup: React.FC = () => {
  const walletStore = useWalletStore()
  const messageStore = useMessagingStore()

  const onExportMessages = useCallback(async () => {
    if (!walletStore.unlockedWallet?.password) {
      alert("Please unlock your wallet first")
      return
    }

    try {
      const blob = await messageStore.exportMessages(
        walletStore.unlockedWallet,
        walletStore.unlockedWallet.password
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const now = new Date()
      a.href = url
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
        .padStart(2, "0")}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      alert("Messages exported successfully!")
    } catch (error) {
      console.error("Error exporting messages:", error)
      alert("Failed to export messages")
    }
  }, [messageStore, walletStore.unlockedWallet])

  const onImportMessages = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!walletStore.unlockedWallet?.password) {
        alert("Please unlock your wallet first")
        return
      }

      try {
        await messageStore.importMessages(
          file,
          walletStore.unlockedWallet,
          walletStore.unlockedWallet.password
        )
        alert("Messages imported successfully!")
      } catch (error: unknown) {
        console.error("Error importing messages:", error)
        alert(
          error instanceof Error ? error.message : "Failed to import messages"
        )
      }

      // Clear the input
      event.target.value = ""
    },
    [messageStore, walletStore.unlockedWallet]
  )

  return (
    <div className="space-y-2 max-w-3/4">
      <h4 className="text-lg font-semibold mb-2">Message Backup</h4>
      <button
        onClick={onExportMessages}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 w-full text-center cursor-pointer"
      >
        Export Messages
      </button>
      {/* Import Messages Button */}
      <label
        htmlFor="importInput"
        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 w-full text-center cursor-pointer block"
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
  )
}
