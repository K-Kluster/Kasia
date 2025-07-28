import { FC, useMemo, useEffect, useState, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Pencil, Info, Copy, Check, UserCog } from "lucide-react";
import { FetchApiMessages } from "../components/FetchApiMessages";
import { MessagesList } from "../components/MessagesList";
import { SendMessageForm } from "./SendMessageForm";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { KaspaAddress } from "../components/KaspaAddress";
import { Contact } from "../types/all";
import styles from "../components/NewChatForm.module.css";
import clsx from "clsx";
import { useIsMobile } from "../utils/useIsMobile";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { EditNicknamePopover } from "../components/EditNicknamePopover";
import { useUiStore } from "../store/ui.store";
import { copyToClipboard } from "../utils/copy-to-clipboard";

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

  const [isEditingInPopover, setIsEditingInPopover] = useState(false);
  const [popoverEditValue, setPopoverEditValue] = useState(
    currentContact?.nickname || ""
  );

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

  function truncateNickname(nickname: string, maxLength = 20) {
    if (!nickname) return "";
    return nickname.length > maxLength
      ? nickname.slice(0, maxLength - 3) + "..."
      : nickname;
  }

  const finalClassName = `flex flex-[2] flex-col overflow-x-hidden ${isMobile ? "" : "border-l border-primary-border"} ${isMobile && mobileView === "contacts" ? "hidden" : ""}`;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // reset nickname editing when popover closes
  useEffect(() => {
    if (!popoverOpen) setIsEditingInPopover(false);
  }, [popoverOpen]);

  const openModal = useUiStore((s) => s.openModal);
  const setContactInfoContact = useUiStore((s) => s.setContactInfoContact);

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
          <div className="flex h-[60px] items-center justify-between bg-[var(--secondary-bg)] px-4">
            {/* mobile back button */}
            <div className="flex items-center">
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

              <h3 className="flex items-center gap-2 truncate text-base font-semibold">
                {isEditingNickname ? (
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
                ) : currentContact?.nickname ? (
                  <span title={currentContact.nickname}>
                    {isMobile
                      ? truncateNickname(currentContact.nickname)
                      : currentContact.nickname}
                  </span>
                ) : (
                  <KaspaAddress address={openedRecipient ?? ""} />
                )}
                <Popover className="relative">
                  {({ open }) => {
                    // Only update state if it actually changed, and never in render
                    if (open !== popoverOpen) {
                      // Use a microtask to avoid updating state during render
                      Promise.resolve().then(() => setPopoverOpen(open));
                    }
                    return (
                      <>
                        <PopoverButton className="cursor-pointer rounded p-1 text-[var(--button-primary)] hover:text-[var(--button-primary)]/80 focus:outline-none">
                          <UserCog className="size-6 sm:size-5" />
                        </PopoverButton>
                        <PopoverPanel
                          anchor="bottom end"
                          className="absolute right-0 z-10 mt-2 w-48 rounded bg-[var(--primary-bg)] shadow-2xl ring-1 shadow-(color:--button-primary)/30 ring-[var(--primary-border)]"
                        >
                          <div className="flex flex-col">
                            <button
                              onClick={() => {
                                copyToClipboard(
                                  currentContact?.address ??
                                    openedRecipient ??
                                    "",
                                  "Address Copied"
                                );
                                setIsCopying(true);
                                setTimeout(() => setIsCopying(false), 1000);
                              }}
                              className={clsx(
                                "flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 transition duration-300",
                                {
                                  "bg-kas-secondary text-white": isCopying,
                                  "hover:bg-secondary-bg focus:bg-secondary-bg active:bg-secondary-bg text-[var(--text-primary)]":
                                    !isCopying,
                                }
                              )}
                              title="Copy Address"
                            >
                              {isCopying ? (
                                <Check className="h-4 w-4 text-white" />
                              ) : (
                                <Copy className="h-4 w-4 text-[var(--text-primary)]" />
                              )}
                              Copy Address
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingInPopover(true);
                                setPopoverEditValue(
                                  currentContact?.nickname || ""
                                );
                              }}
                              className={clsx(
                                "hover:bg-secondary-bg focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)]",
                                { hidden: isEditingInPopover }
                              )}
                            >
                              <Pencil className="h-4 w-4" /> Edit Nickname
                            </button>
                            {isEditingInPopover && (
                              <EditNicknamePopover
                                value={popoverEditValue}
                                placeholder={
                                  currentContact?.nickname ||
                                  currentContact?.address ||
                                  ""
                                }
                                onChange={setPopoverEditValue}
                                onSave={() => {
                                  if (currentContact) {
                                    messageStore.setContactNickname(
                                      currentContact.address,
                                      popoverEditValue
                                    );
                                  }
                                  setIsEditingInPopover(false);
                                }}
                                onCancel={() => setIsEditingInPopover(false)}
                              />
                            )}
                            <button
                              onClick={() => {
                                setContactInfoContact(currentContact ?? null);
                                openModal("contact-info-modal");
                              }}
                              className="hover:bg-secondary-bg focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)]"
                            >
                              <Info className="h-4 w-4" /> Contact Info
                            </button>
                          </div>
                        </PopoverPanel>
                      </>
                    );
                  }}
                </Popover>
              </h3>
            </div>
            {openedRecipient && (
              <div className="flex items-center gap-3">
                {address && <FetchApiMessages address={address.toString()} />}
              </div>
            )}
          </div>

          <div
            className="bg-primary-bg flex-1 overflow-x-hidden overflow-y-auto p-4 pb-8"
            ref={messagesScrollRef}
          >
            <MessagesList
              messages={messageStore.messagesOnOpenedRecipient}
              address={address?.toString() || null}
              lastOutgoing={lastOutgoing}
              lastIncoming={lastIncoming}
            />
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
