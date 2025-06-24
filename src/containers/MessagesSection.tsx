import { FC, useCallback, useEffect, useMemo } from "react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { TrashIcon } from "@heroicons/react/24/outline";
import { KaspaAddress } from "../components/KaspaAddress";

export const MessageSection: FC = () => {
  const messageStore = useMessagingStore();
  const address = useWalletStore((s) => s.address);

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
    if (!address) {
      return;
    }

    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(address.toString());
    }
  }, [address, messageStore]);

  return (
    <div className="messages-section">
      {boxState === "new" ? (
        // ONBOARDING
        <>
          <div className="messages-header"></div>
          <div className="messages-list">
            <div className="no-messages">
              Start by funding your wallet with some Kas (should be a small
              amount such as 10 Kas) and chat to someone by clicking the add (+)
              button on the top-left corner
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
          <div className="messages-header">
            <h3 className="text-base font-semibold">
              <KaspaAddress address={openedRecipient ?? ""} />
            </h3>
            <div className="header-actions">
              {address && <FetchApiMessages address={address.toString()} />}
              <button className="cursor-pointer p-2" onClick={onClearHistory}>
                <TrashIcon className="w-6 h-6 text-red-200 hover:scale-110" />
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
            {messageStore.messagesOnOpenedRecipient.length ? (
              messageStore.messagesOnOpenedRecipient.map((msg) => (
                <MessageDisplay
                  isOutgoing={msg.senderAddress === address?.toString()}
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
