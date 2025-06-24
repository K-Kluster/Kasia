import { FC, useCallback, useMemo } from "react";
import { ChevronLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { KaspaAddress } from "../components/KaspaAddress";

export const MessageSection: FC<{
  mobileView: "contacts" | "messages";
  setMobileView: (v: "contacts" | "messages") => void;
}> = ({ mobileView, setMobileView }) => {
  const messageStore = useMessagingStore();
  const address = useWalletStore((s) => s.address);

  const contacts = useMessagingStore((s) => s.contacts);
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);

  const boxState = useMemo<"new" | "filtered" | "unfiltered">(() => {
    if (!contacts.length) return "new";
    if (!openedRecipient) return "unfiltered";
    return "filtered";
  }, [contacts, openedRecipient]);

  const onClearHistory = useCallback(() => {
    if (!address) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(address.toString());
    }
  }, [address, messageStore]);

  return (
    <div
      className={`
        flex flex-col flex-[2] border-l border-[var(--border-color)]
        ${mobileView === "contacts" ? "hidden sm:flex" : ""}
      `}
    >
      {boxState === "new" && (
        /* ONBOARDING ─ show help when no contacts exist */
        <>
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--secondary-bg)] h-[60px]" />
          <div className="flex-1 overflow-y-auto p-4 bg-[var(--primary-bg)] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:20px_20px]">
            <div className="text-center text-[var(--text-secondary)] py-10 px-5 italic bg-[rgba(0,0,0,0.2)] rounded-[12px] m-5">
              Start by funding your wallet with some Kas (should be a small
              amount such as 10 Kas) and chat to someone by clicking the add (+)
              button on the top-left corner
            </div>
          </div>
        </>
      )}
       {boxState === "unfiltered" && (
         //NOT SELECTED ANY CONTACT
        <>
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--secondary-bg)] h-[60px]" />
          <div className="flex-1 overflow-y-auto p-4 bg-[var(--primary-bg)] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:20px_20px]">
            <div className="text-center text-[var(--text-secondary)] py-10 px-5 italic bg-[rgba(0,0,0,0.2)] rounded-[12px] m-5">
              Select a contact to view the conversation.
            </div>
          </div>
        </>
      )}

      {boxState === "filtered" && (
        /* A CONVERSATION IS OPEN */
        <>
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--secondary-bg)] h-[60px]">
            {/* mobile back button */}
            <button
              onClick={() => setMobileView("contacts")}
              className="sm:hidden mr-2 p-1"
              aria-label="Back to contacts"
            >
              <ChevronLeftIcon className="size-6" />
            </button>

            <h3 className="text-base font-semibold flex-1 truncate">
              <KaspaAddress address={openedRecipient ?? ""} />
            </h3>

            <div className="flex items-center gap-3">
              {address && <FetchApiMessages address={address.toString()} />}
              <button className="cursor-pointer p-2" onClick={onClearHistory}>
                <TrashIcon className="w-6 h-6 text-red-200 hover:scale-110" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto p-4 bg-[var(--primary-bg)] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:20px_20px]"
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
              <div className="text-center text-[var(--text-secondary)] py-10 px-5 italic bg-[rgba(0,0,0,0.2)] rounded-[12px] m-5">
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
