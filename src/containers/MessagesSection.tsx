import { FC, useMemo, useEffect, useState, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Pencil, CheckCircle, XCircle, Info, Copy } from "lucide-react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessageDisplay } from "../components/MessageDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { KaspaAddress } from "../components/KaspaAddress";
import { AvatarHash } from "../components/icons/AvatarHash";
import { Contact } from "../types/all";
import styles from "../components/NewChatForm.module.css";
import clsx from "clsx";
import { toast } from "../utils/toast";
import { useIsMobile } from "../utils/useIsMobile";

export const MessageSection: FC<{
  mobileView: "contacts" | "messages";
  setMobileView: (v: "contacts" | "messages") => void;
}> = ({ mobileView, setMobileView }) => {
  const messageStore = useMessagingStore();
  const address = useWalletStore((s) => s.address);
  const isMobile = useIsMobile();

  const contacts = useMessagingStore((s) => s.contacts);
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);

  // Find the current contact for display purposes
  const currentContact = useMemo(() => {
    if (!openedRecipient) return null;
    return contacts.find((c) => c.address === openedRecipient);
  }, [contacts, openedRecipient]);

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

  // Nickname editing state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState("");

  // Contact info tooltip state
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Copy feedback state
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Nickname editing handlers
  const handleNicknameSave = () => {
    if (currentContact) {
      messageStore.setContactNickname(currentContact.address, tempNickname);
      setIsEditingNickname(false);
    }
  };

  const handleNicknameCancel = () => {
    setTempNickname(currentContact?.nickname || "");
    setIsEditingNickname(false);
  };

  const startEditingNickname = () => {
    setTempNickname(currentContact?.nickname || "");
    setIsEditingNickname(true);
  };

  const handleCopyAddress = () => {
    const addressToCopy = currentContact?.address || openedRecipient;
    if (addressToCopy) {
      navigator.clipboard.writeText(addressToCopy).then(() => {
        setShowCopySuccess(true);
        toast.info("Address copied");
        // Reset the icon after 1.5 seconds
        setTimeout(() => {
          setShowCopySuccess(false);
        }, 1500);
      });
    }
  };

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

  const messagesScrollRef = useRef<HTMLDivElement>(null);

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

  // scroll when child calls eg. the chat expansion has collpased
  const scrollToBottom = () => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  // scroll if the conversation is open or box state changes
  useEffect(() => {
    if (boxState === "filtered" && messagesScrollRef.current) {
      messagesScrollRef.current.scrollTo({
        top: messagesScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messageStore.messagesOnOpenedRecipient, boxState]);

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

  const finalClassName = `flex flex-[2] flex-col overflow-x-hidden ${isMobile ? "" : "border-l border-primary-border"} ${isMobile && mobileView === "contacts" ? "hidden" : ""}`;

  return (
    <div className={finalClassName}>
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
          <div className="border-primary-border h-[60px] border-b bg-[var(--secondary-bg)] p-4" />
          <div className="bg-primary-bg flex-1 overflow-y-auto p-4">
            <div className="m-5 rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
              Start by funding your wallet with some Kas (should be a small
              amount such as 10 Kas) and chat to someone by clicking the add (+)
              button on the top-left corner
            </div>
          </div>
        </>
      )}

      {boxState === "filtered" && (
        /* A CONVERSATION IS OPEN */
        <>
          <div className="flex h-[60px] items-center justify-between bg-[var(--secondary-bg)] p-4">
            {/* mobile back button */}
            <button
              onClick={() => {
                setMobileView("contacts");
                messageStore.setOpenedRecipient(null);
              }}
              className="mr-2 cursor-pointer p-1 sm:hidden"
              aria-label="Back to contacts"
            >
              <ChevronLeft className="size-6" />
            </button>

            <h3 className="truncate text-base font-semibold">
              {isEditingNickname ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleNicknameSave();
                        if (e.key === "Escape") handleNicknameCancel();
                      }}
                      autoFocus
                      placeholder={currentContact?.address}
                      className="h-6 flex-1 rounded-sm border border-gray-600 bg-transparent px-2 text-sm leading-none"
                    />
                    <button
                      onClick={handleNicknameSave}
                      className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                      title="Save nickname"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </button>
                    <button
                      onClick={handleNicknameCancel}
                      className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                      title="Cancel editing"
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                  <button
                    onMouseEnter={() => setShowContactInfo(true)}
                    onMouseLeave={() => setShowContactInfo(false)}
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Contact info"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyAddress}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Copy address"
                  >
                    {showCopySuccess ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ) : currentContact?.nickname ? (
                <span className="flex items-center gap-2">
                  <span>{currentContact.nickname}</span>
                  <button
                    onClick={startEditingNickname}
                    title="Edit nickname"
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onMouseEnter={() => setShowContactInfo(true)}
                    onMouseLeave={() => setShowContactInfo(false)}
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Contact info"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyAddress}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Copy address"
                  >
                    {showCopySuccess ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <KaspaAddress address={openedRecipient ?? ""} />
                  <button
                    onClick={startEditingNickname}
                    title="Edit nickname"
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onMouseEnter={() => setShowContactInfo(true)}
                    onMouseLeave={() => setShowContactInfo(false)}
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Contact info"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyAddress}
                    className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
                    title="Copy address"
                  >
                    {showCopySuccess ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </span>
              )}
            </h3>

            {openedRecipient && (
              <div className="flex items-center gap-3">
                {address && <FetchApiMessages address={address.toString()} />}
              </div>
            )}
          </div>

          {/* Contact Info Tooltip */}
          {showContactInfo && currentContact && (
            <div className="bg-secondary-bg border-primary-border absolute top-[15%] left-[20%] z-50 max-w-sm rounded-lg border p-4 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10">
                    <AvatarHash
                      address={currentContact.address}
                      size={40}
                      className={clsx({
                        "opacity-60": !!currentContact.nickname?.trim()?.[0],
                      })}
                    />
                    {currentContact.nickname?.trim()?.[0]?.toUpperCase() && (
                      <span
                        className={clsx(
                          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+1px)]",
                          "pointer-events-none select-none",
                          "flex h-10 w-10 items-center justify-center",
                          "rounded-full text-sm leading-none font-bold tracking-wide text-gray-200"
                        )}
                      >
                        {currentContact.nickname.trim()[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {currentContact.nickname || "No nickname"}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      Contact
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                      Address
                    </div>
                    <div className="text-sm break-all text-[var(--text-primary)]">
                      {currentContact.address}
                    </div>
                  </div>

                  {currentContact.nickname && (
                    <div>
                      <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                        Nickname
                      </div>
                      <div className="text-sm text-[var(--text-primary)]">
                        {currentContact.nickname}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                      Messages
                    </div>
                    <div className="text-sm text-[var(--text-primary)]">
                      {currentContact.messages?.length || 0} messages
                    </div>
                  </div>

                  {currentContact.lastMessage && (
                    <div>
                      <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                        Last Message
                      </div>
                      <div className="text-sm text-[var(--text-primary)]">
                        {new Date(
                          currentContact.lastMessage.timestamp
                        ).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            className="bg-primary-bg flex-1 overflow-x-hidden overflow-y-auto p-4"
            ref={messagesScrollRef}
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
              <div className="m-5 rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
                No messages in this conversation.
              </div>
            )}
          </div>

          <SendMessageForm onExpand={scrollToBottom} />
        </>
      )}

      <div className="hidden">
        {address && <FetchApiMessages address={address.toString()} />}
      </div>
    </div>
  );
};
