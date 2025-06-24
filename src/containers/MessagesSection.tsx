import { FC, useCallback, useMemo, useEffect, useState, useRef } from "react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { TrashIcon } from "@heroicons/react/24/outline";
import { KaspaAddress } from "../components/KaspaAddress";
import { Contact } from "../types/all";
import styles from "../components/NewChatForm.module.css";
import { NewChatForm } from "../components/NewChatForm";

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
    <div className="messages-section">
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
      {messageStore.isCreatingNewChat && (
        <div className={styles["modal-overlay"]}>
          <NewChatForm
            onClose={() => {
              messageStore.setIsCreatingNewChat(false);
            }}
          />
        </div>
      )}
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
