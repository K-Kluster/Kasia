import { FC, useCallback, useMemo, useEffect, useState, useRef } from "react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { Contact } from "../types/all";
import styles from "../components/NewChatForm.module.css";
import { NewChatForm } from "../components/NewChatForm";
import { kaspaToSompi } from "kaspa-wasm";
import {
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { KaspaAddress } from "../components/KaspaAddress";

export const MessageSection: FC = () => {
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const contacts = useMessagingStore((s) => s.contacts);
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const balance = useWalletStore((state) => state.balance);

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
  const [knsMovedAssetId, setKnsMovedAssetId] = useState<string | null>(null);

  // Pre-filled values for direct handshake
  const [prefilledRecipient, setPrefilledRecipient] = useState<string>("");
  const [prefilledResolvedAddress, setPrefilledResolvedAddress] =
    useState<string>("");
  const [prefilledDomainId, setPrefilledDomainId] = useState<string>("");

  const lastKnsCheckRef = useRef<{ nickname: string; address: string } | null>(
    null
  );

  // Check if KNS moved warning should be ignored for this domain
  const isKnsWarningIgnored = knsMovedDomain
    ? localStorage.getItem(`ignoreKnsMoved_${knsMovedDomain}`) === "1"
    : false;

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
            setKnsMovedAssetId(data.data.assetId || null);
            setShowKnsMovedModal(true);
          }
        }
      })
      .catch(() => {});
  }, [boxState, openedRecipient, contacts]);

  useEffect(() => {
    if (!openedRecipient) return;
    const contact = contacts.find((c) => c.address === openedRecipient);
    if (!contact || !contact.nickname) return;
    // Check if nickname is @username
    const knsMatch = contact.nickname.match(/^@([a-zA-Z0-9_-]+)$/);
    if (!knsMatch) return;
    const domain = knsMatch[1] + ".kas";
    // If warning is ignored, do not show
    if (localStorage.getItem(`ignoreKnsMoved_${domain}`) === "1") return;
    // Fetch current owner of the domain
    fetch(
      `https://api.knsdomains.org/mainnet/api/v1/${encodeURIComponent(
        domain
      )}/owner`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.owner) {
          if (data.data.owner.toLowerCase() !== contact.address.toLowerCase()) {
            setKnsMovedContact(contact);
            setKnsMovedDomain(domain);
            setKnsMovedNewAddress(data.data.owner);
            setKnsMovedAssetId(data.data.assetId || null);
            setShowKnsMovedModal(true);
          }
        }
      });
  }, [openedRecipient, contacts]);

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

  // Handle direct handshake creation from KNS moved modal
  const handleDirectHandshakeCreation = async (domain: string) => {
    setShowKnsMovedModal(false);

    try {
      const response = await fetch(
        `https://api.knsdomains.org/mainnet/api/v1/${encodeURIComponent(
          domain
        )}/owner`
      );
      const data = await response.json();

      if (data.success && data.data && data.data.owner) {
        setPrefilledRecipient(domain);
        setPrefilledResolvedAddress(data.data.owner);
        setPrefilledDomainId(data.data.assetId || "");
        messageStore.setIsCreatingNewChat(true);
      } else {
        alert("KNS domain does not exist");
      }
    } catch (error) {
      alert("Failed to resolve KNS domain");
    }
  };

  // Show KNS domain moved warning if:
  // - The contact's nickname is in the form '@username'
  // - The user no longer owns 'username.kas'
  const isKnsNickname =
    knsMovedContact &&
    knsMovedContact.nickname &&
    /^@[a-zA-Z0-9_-]+$/.test(knsMovedContact.nickname);
  const knsDomainFromNickname = isKnsNickname
    ? (knsMovedContact.nickname ?? "").slice(1) + ".kas"
    : null;
  const shouldShowKnsMovedWarning =
    showKnsMovedModal &&
    isKnsNickname &&
    knsDomainFromNickname &&
    knsDomainFromNickname.toLowerCase() ===
      (knsMovedDomain || "").toLowerCase();

  return (
    <div className="messages-section">
      {showKnsMovedModal &&
        knsMovedDomain &&
        knsMovedNewAddress &&
        knsMovedContact && (
          <div
            className="fixed inset-0 bg-black/50 flex justify-center items-center z-20"
            onClick={() => setShowKnsMovedModal(false)}
          >
            <div
              className="bg-bg-secondary p-6 rounded-lg w-[576px] flex flex-col items-center relative border border-[var(--border-color)] mx-4 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowKnsMovedModal(false)}
                className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              <h3
                style={{
                  marginBottom: 12,
                  textAlign: "center",
                  color: "#f59e0b",
                  fontWeight: "bold",
                  fontSize: 22,
                }}
              >
                KNS Domain Moved
              </h3>
              <p
                style={{
                  wordBreak: "break-all",
                  marginBottom: 10,
                  textAlign: "center",
                  fontSize: 14,
                }}
              >
                The KNS domain{" "}
                {knsMovedAssetId ? (
                  <a
                    href={`https://app.knsdomains.org/asset/${knsMovedAssetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#7fd6ff",
                      textDecoration: "none",
                      fontWeight: "bold",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = "underline";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = "none";
                    }}
                  >
                    <b>{knsMovedDomain}</b>
                    <ArrowTopRightOnSquareIcon className="size-4" />
                  </a>
                ) : (
                  <b>{knsMovedDomain}</b>
                )}{" "}
                is now linked to a different address.
                <br />
                {/* Old address, full and strikethrough */}
                <span
                  style={{
                    fontSize: 14,
                    color: "#94a3b8",
                    wordBreak: "break-all",
                    textDecoration: "line-through",
                    opacity: 0.7,
                    display: "block",
                  }}
                >
                  {knsMovedContact.address}
                </span>
                {/* New address, full and normal style */}
                <span
                  style={{
                    fontSize: 14,
                    color: "#7fd6ff",
                    wordBreak: "break-all",
                    display: "block",
                  }}
                >
                  {knsMovedNewAddress}
                </span>
              </p>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  width: "100%",
                }}
              >
                <button
                  className={`${styles.button}`}
                  style={{
                    background: "rgba(33, 150, 243, 0.2)",
                    color: "#2196f3",
                    border: "1px solid rgba(33, 150, 243, 0.5)",
                  }}
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
                  className={`${styles.button}`}
                  style={{
                    background: "rgba(33, 150, 243, 0.2)",
                    color: "#2196f3",
                    border: "1px solid rgba(33, 150, 243, 0.5)",
                  }}
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
                  className={`${styles.button}`}
                  style={{
                    background: "rgba(33, 150, 243, 0.2)",
                    color: "#2196f3",
                    border: "1px solid rgba(33, 150, 243, 0.5)",
                  }}
                  onClick={() => {
                    // If nickname is @username, append (old)
                    if (
                      knsMovedContact?.nickname &&
                      /^@[a-zA-Z0-9_-]+$/.test(knsMovedContact.nickname)
                    ) {
                      messageStore.setContactNickname(
                        knsMovedContact.address,
                        knsMovedContact.nickname + " (old)"
                      );
                    }
                    handleDirectHandshakeCreation(knsMovedDomain || "");
                  }}
                >
                  Create new conversation with {knsMovedDomain}
                </button>
              </div>
            </div>
          </div>
        )}
      {shouldShowKnsMovedWarning && !isKnsWarningIgnored && (
        <div className={styles["modal-overlay"]}>
          {/* ... KNS domain moved modal ... */}
        </div>
      )}
      {messageStore.isCreatingNewChat && (
        <div className={styles["modal-overlay"]}>
          <NewChatForm
            onClose={() => {
              messageStore.setIsCreatingNewChat(false);
              setPrefilledRecipient("");
              setPrefilledResolvedAddress("");
              setPrefilledDomainId("");
            }}
            prefilledRecipient={prefilledRecipient}
            prefilledResolvedAddress={prefilledResolvedAddress}
            prefilledDomainId={prefilledDomainId}
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
