import { FC, useCallback, useMemo } from "react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";

export const MessageSection: FC = () => {
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const contacts = useMessagingStore((s) => s.contacts);
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);

  const boxState = useMemo<"new" | "filtered" | "unfiltered">(() => {
    if (!contacts.length) {
      return "new";
    }

    if (!openedRecipient) {
      return "unfiltered";
    }

    return "filtered";
  }, [contacts, openedRecipient]);

  const onClearHistory = useCallback(() => {
    if (!walletStore.address) {
      return;
    }

    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(walletStore.address.toString());
    }
  }, [walletStore.address, messageStore]);

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

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kaspa-messages-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
    <div className="messages-section">
      {boxState === "new" ? (
        // ONBOARDING
        <>
          <div className="messages-header"></div>
          <div className="messages-list">
            <div className="no-messages">
              Start by funding your wallet with some Kas (should be a small
              amount such as 10 Kas) and chat to someone by clicking the add (+) button on the top-left corner
            </div>
          </div>
        </>
      ) : boxState === "unfiltered" ? (
        // NOT SELECTED ANY CONTACT
        <>
          <div className="messages-header"></div>
          <div className="messages-list">
            <div className="no-messages">
              Click on a contact to access the conversation
            </div>
          </div>
        </>
      ) : (
        // SELECTED A CONTACT
        <>
          {" "}
          <div className="messages-header">
            <h3>Messages</h3>
            <div className="header-actions">
              {walletStore.address && (
                <FetchApiMessages address={walletStore.address.toString()} />
              )}
              <button
                onClick={onExportMessages}
                className="backup-button"
                title="Export message backup"
              >
                Export Backup
              </button>
              <label className="import-button" title="Import message backup">
                Import Backup
                <input
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={onImportMessages}
                />
              </label>
              <button
                onClick={onClearHistory}
                id="clearHistoryButton"
                className="clear-history-button"
              >
                Clear History
              </button>
            </div>
          </div>
          <div
            className="messages-list"
            ref={(el) => {
              // Auto-scroll to bottom when new messages arrive
              if (el) {
                el.scrollTop = el.scrollHeight;
              }
            }}
          >
            {messageStore.isCreatingNewChat ? (
              <div className="no-messages">
                Enter a recipient address to start a new conversation.
              </div>
            ) : messageStore.messagesOnOpenedRecipient.length ? (
              messageStore.messagesOnOpenedRecipient.map((msg) => (
                <MessageDisplay
                  isOutgoing={
                    msg.senderAddress === walletStore.address?.toString()
                  }
                  key={msg.transactionId}
                  message={msg}
                />
              ))
            ) : (
              <div className="no-messages">
                No messages in this conversation.
              </div>
            )}
          </div>
          <SendMessageForm />
        </>
      )}
    </div>
  );
};
