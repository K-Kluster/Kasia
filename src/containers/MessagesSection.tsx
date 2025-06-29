import { FC, useMemo, useEffect, useState, useRef } from "react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { KaspaAddress } from "../components/KaspaAddress";
import { Contact } from "../types/all";
import styles from "../components/NewChatForm.module.css";

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

  // KNS domain move check state
  const [showKnsMovedModal, setShowKnsMovedModal] = useState(false);
  const [knsMovedNewAddress, setKnsMovedNewAddress] = useState<string | null>(
    null
  );
  const [knsMovedDomain, setKnsMovedDomain] = useState<string | null>(null);
  const [knsMovedContact, setKnsMovedContact] = useState<Contact | null>(null);

  const lastKnsCheckRef = useRef<{ nickname: string; address: string } | null>(
    null
  );

  // compute last index of outgoing and incoming messages so we can render the message ui accordingly!
  const { lastOutgoing, lastIncoming } = useMemo(() => {
    const msgs = messageStore.messagesOnOpenedRecipient;
    let lastOut = -1;
    let lastIn = -1;
    msgs.forEach((m, i) => {
      if (m.senderAddress === address?.toString()) lastOut = i;
      else lastIn = i;
    });
    return { lastOutgoing: lastOut, lastIncoming: lastIn };
  }, [messageStore.messagesOnOpenedRecipient, address]);

  useEffect(() => {
    if (boxState !== "filtered" || !openedRecipient) return;
    const contact = contacts.find((c) => c.address === openedRecipient);
    if (!contact || !contact.nickname || !contact.nickname.endsWith(".kas"))
      return;
    // Check if user has chosen to ignore warnings for this domain
    const ignoreKey = `ignoreKnsMoved_${contact.nickname}`;
    if (localStorage.getItem(ignoreKey) === "1") return;
    // Only check if nickname/address changed
    if (
      lastKnsCheckRef.current &&
      lastKnsCheckRef.current.nickname === contact.nickname &&
      lastKnsCheckRef.current.address === contact.address
    ) {
      return;
    }
    lastKnsCheckRef.current = {
      nickname: contact.nickname,
      address: contact.address,
    };
    // Fetch current KNS owner
    fetch(
      `https://api.knsdomains.org/mainnet/api/v1/${encodeURIComponent(
        contact.nickname
      )}/owner`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.owner) {
          if (data.data.owner !== contact.address) {
            setKnsMovedNewAddress(data.data.owner);
            setKnsMovedDomain(contact.nickname || "");
            setKnsMovedContact(contact);
            setShowKnsMovedModal(true);
          }
        }
      })
      .catch(() => {});
  }, [boxState, openedRecipient, contacts]);

  // Helper to format old domain nickname
  function formatOldDomainNickname(domain: string) {
    if (!domain) return "";
    if (domain.length <= 15) {
      return `(OLD) ${domain}`;
    }
    // Truncate long domains: [old] verylongdomain...kas
    const prefix = "[old] ";
    const suffix = domain.slice(-3); // Keep the .kas part
    const availableLength = 20 - prefix.length - 3; // 3 for "..."
    const truncatedPart = domain.slice(0, availableLength);
    return `${prefix}${truncatedPart}...${suffix}`;
  }

  return (
    <div
      className={`
        flex flex-col flex-[2] border-l border-[var(--border-color)]
        ${mobileView === "contacts" ? "hidden sm:flex" : ""}
      `}
    >
      {showKnsMovedModal &&
        knsMovedDomain &&
        knsMovedNewAddress &&
        knsMovedContact && (
          <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div
              className="modal"
              style={{
                background: "#222",
                color: "#fff",
                padding: 24,
                borderRadius: 12,
                maxWidth: 800,
                margin: "80px auto",
                boxShadow: "0 2px 16px #0008",
              }}
            >
              <h3
                style={{
                  marginBottom: 12,
                  textAlign: "center",
                  color: "#ff4444",
                  fontWeight: "bold",
                }}
              >
                KNS Domain Moved
              </h3>
              <p style={{ wordBreak: "break-all", marginBottom: 10 }}>
                The KNS domain <b>{knsMovedDomain}</b> is now linked to a
                different address.
                <br />
                <span
                  style={{
                    fontSize: 13,
                    color: "#7fd6ff",
                    wordBreak: "break-all",
                  }}
                >
                  Old: {knsMovedContact.address}
                </span>
                <br />
                <span
                  style={{
                    fontSize: 13,
                    color: "#7fd6ff",
                    wordBreak: "break-all",
                  }}
                >
                  New: {knsMovedNewAddress}
                </span>
              </p>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <button
                  className={`${styles.button} ${styles["submit-button"]}`}
                  onClick={() => {
                    messageStore.setContactNickname(
                      knsMovedContact.address,
                      ""
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Change Nickname
                </button>
                <button
                  className={`${styles.button} ${styles["submit-button"]}`}
                  onClick={() => {
                    localStorage.setItem(
                      `ignoreKnsMoved_${knsMovedDomain}`,
                      "1"
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Keep Nickname & Ignore Future Warnings
                </button>
                <button
                  className={`${styles.button} ${styles["submit-button"]}`}
                  onClick={() => {
                    messageStore.setIsCreatingNewChat(true);
                    messageStore.setContactNickname(
                      knsMovedContact.address,
                      formatOldDomainNickname(knsMovedDomain || "")
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Create new conversation with {knsMovedDomain}
                </button>
              </div>
            </div>
          </div>
        )}
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

            <h3 className="text-base font-semibold truncate">
              <KaspaAddress address={openedRecipient ?? ""} />
            </h3>

            <div className="flex items-center gap-3">
              {address && <FetchApiMessages address={address.toString()} />}
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[var(--primary-bg)] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:20px_20px]"
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            {messageStore.messagesOnOpenedRecipient.length ? (
              messageStore.messagesOnOpenedRecipient.map((msg, idx) => {
                const isOutgoing = msg.senderAddress === address?.toString();
                const showTimestamp = isOutgoing
                  ? idx === lastOutgoing
                  : idx === lastIncoming;

                return (
                  <MessageDisplay
                    key={msg.transactionId}
                    isOutgoing={isOutgoing}
                    showTimestamp={showTimestamp}
                    message={msg}
                  />
                );
              })
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
