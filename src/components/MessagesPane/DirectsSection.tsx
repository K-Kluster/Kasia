import { FC, useEffect, useState, useRef } from "react";
import { ChevronLeft, Users, Info, Crown } from "lucide-react";

import { DirectsList } from "./Directs/DirectsList";
import { DirectComposer } from "./Composing/Directs/DirectComposer";
import { useMessagingStore } from "../../store/messaging.store";
import { useWalletStore } from "../../store/wallet.store";
import { useGroupStore } from "../../store/group.store";
import { KaspaAddress } from "../KaspaAddress";

import { useIsMobile } from "../../hooks/useIsMobile";
import { ContactMenu } from "../ContactMenu";
import { useUiStore } from "../../store/ui.store";

import { Contact } from "../../store/repository/contact.repository";
import { Avatar } from "../SideBarPane/Directs/Avatar";
import { Button } from "../Common/Button";
import { GroupMessagesList } from "./Groups/GroupMessagesList";

export const DirectsSection: FC<{
  mobileView: "contacts" | "messages";
  setMobileView: (v: "contacts" | "messages") => void;
}> = ({ mobileView, setMobileView }) => {
  const messageStore = useMessagingStore();
  const isMobile = useIsMobile();
  const { address } = useWalletStore();

  // group state
  const groupStore = useGroupStore();
  const selectedGroupId = groupStore.selectedGroupId;
  const groupWithMessages = selectedGroupId
    ? groupStore.getGroupWithMessages(selectedGroupId)
    : null;
  const oneOnOneConversations = useMessagingStore(
    (s) => s.oneOnOneConversations
  );
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);

  // Find the current contact for display purposes
  const oneOnOneConversation = openedRecipient
    ? oneOnOneConversations.find(
        (oooc) => oooc.contact.kaspaAddress === openedRecipient
      )
    : null;

  // determine what state we're in - mutually exclusive (group takes priority)
  const isGroupView = !!selectedGroupId && !!groupWithMessages;
  const isDirectView =
    !isGroupView && !!openedRecipient && !!oneOnOneConversation;
  const hasConversations =
    oneOnOneConversations.length > 0 || groupStore.groups.length > 0;

  // check if current user is admin of the selected group
  const isAdmin = groupWithMessages?.group.adminAddress === address?.toString();

  const boxState = !hasConversations
    ? "new"
    : !openedRecipient && !selectedGroupId
      ? "unfiltered"
      : "filtered";

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
  // compute last index of outgoing and incoming messages so we can render the message ui accordingly
  const conversationEvents = oneOnOneConversation?.events;
  let lastOutgoing = -1;
  let lastIncoming = -1;

  if (conversationEvents) {
    conversationEvents.forEach((m, i) => {
      if (m.fromMe) lastOutgoing = i;
      else lastIncoming = i;
    });
  }

  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxState !== "filtered" || !openedRecipient) return;

    if (
      !oneOnOneConversation ||
      !oneOnOneConversation.contact.name ||
      !oneOnOneConversation.contact.name.endsWith(".kas")
    )
      return;
    // Check if user has chosen to ignore warnings for this domain
    const ignoreKey = `ignoreKnsMoved_${oneOnOneConversation.contact.name}`;
    if (localStorage.getItem(ignoreKey) === "1") return;
    // Only check if nickname/address changed
    if (
      lastKnsCheckRef.current &&
      lastKnsCheckRef.current.nickname === oneOnOneConversation.contact.name &&
      lastKnsCheckRef.current.address ===
        oneOnOneConversation.contact.kaspaAddress
    ) {
      return;
    }
    lastKnsCheckRef.current = {
      nickname: oneOnOneConversation.contact.name,
      address: oneOnOneConversation.contact.kaspaAddress,
    };
    // Fetch current KNS owner
    fetch(
      `https://api.knsdomains.org/mainnet/api/v1/${encodeURIComponent(
        oneOnOneConversation.contact.name
      )}/owner`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.owner) {
          if (data.data.owner !== oneOnOneConversation.contact.kaspaAddress) {
            setKnsMovedNewAddress(data.data.owner);
            setKnsMovedDomain(oneOnOneConversation.contact.name || "");
            setKnsMovedContact(oneOnOneConversation.contact);
            setShowKnsMovedModal(true);
          }
        }
      })
      .catch(() => {});
  }, [boxState, oneOnOneConversation, openedRecipient]);

  // scroll when child calls eg. the chat expansion has collpased
  const scrollToBottom = () => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  // scroll to bottom when conversation is filtered or new messages are received
  useEffect(() => {
    if (boxState === "filtered" && messagesScrollRef.current) {
      // delay scroll to account for keyboard appearing after autofocus
      if (isMobile) {
        setTimeout(() => scrollToBottom(), 300);
      } else {
        scrollToBottom();
      }
    }
  }, [boxState, oneOnOneConversation?.events.length, isMobile]);

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

  const openModal = useUiStore((state) => state.openModal);
  const setOneOnOneConversation = useUiStore((s) => s.setOneOnOneConversation);
  const { setGroupInfoModalGroup } = useUiStore();

  // scroll to bottom for group messages
  const groupMessagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isGroupView && groupMessagesRef.current) {
      groupMessagesRef.current.scrollTo({
        top: groupMessagesRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [isGroupView, groupWithMessages?.messages.length]);

  // nothing selected and no conversations
  if (boxState === "unfiltered" && !isGroupView && !isDirectView) {
    return (
      <div
        className={`flex flex-[2] flex-col overflow-x-hidden ${isMobile ? "" : "border-primary-border border-l"} ${isMobile && mobileView === "contacts" ? "hidden" : ""}`}
      >
        <div className="h-[60px] bg-[var(--secondary-bg)] p-4" />
        <div className="bg-primary-bg flex flex-1 items-center justify-center">
          <div className="text-center text-[var(--text-secondary)] italic">
            Select a conversation to start messaging
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-[2] flex-col overflow-x-hidden ${isMobile ? "" : "border-primary-border border-l"} ${isMobile && mobileView === "contacts" ? "hidden" : ""}`}
    >
      {/* KNS moved modal */}
      {showKnsMovedModal &&
        knsMovedDomain &&
        knsMovedNewAddress &&
        knsMovedContact && (
          <div className="fixed inset-0 z-[50] flex items-start justify-center overflow-y-auto bg-black/70">
            <div className="mt-20 max-w-xl rounded-xl bg-[var(--primary-bg)] p-6 text-[var(--text-primary)] shadow-2xl">
              <h3 className="mb-3 text-center font-bold text-[var(--accent-red)]">
                KNS Domain Moved
              </h3>
              <p className="mb-2 font-semibold break-all">
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
                  Old: {knsMovedContact.kaspaAddress}
                </span>
                <br />
                <span className="text-sm break-all text-[var(--text-secondary)]">
                  New: {knsMovedNewAddress}
                </span>
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    messageStore.setContactNickname(
                      knsMovedContact.kaspaAddress,
                      ""
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Change Nickname
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    localStorage.setItem(
                      `ignoreKnsMoved_${knsMovedDomain}`,
                      "1"
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Keep Nickname &amp; Ignore Future Warnings
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    openModal("new-chat");
                    messageStore.setContactNickname(
                      knsMovedContact.kaspaAddress,
                      formatOldDomainNickname(knsMovedDomain || "")
                    );
                    setShowKnsMovedModal(false);
                  }}
                >
                  Create new conversation with {knsMovedDomain}
                </Button>
              </div>
            </div>
          </div>
        )}

      {boxState === "new" && (
        /* ONBOARDING ─ show help when no contacts exist */
        <>
          <div className="h-[60px] bg-[var(--secondary-bg)] p-4" />
          <div className="bg-primary-bg flex-1 overflow-x-hidden overflow-y-auto px-1 py-4 pb-8 sm:px-2">
            <div className="m-5 rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
              Start by funding your wallet with some Kas and start a chat by
              clicking + in the contacts section.
            </div>
          </div>
        </>
      )}

      {/* GROUP VIEW */}
      {isGroupView && groupWithMessages && (
        <>
          {/* group header */}
          <div className="flex h-[60px] items-center justify-between bg-[var(--secondary-bg)] px-4">
            <div className="flex items-center">
              <button
                onClick={() => {
                  setMobileView("contacts");
                  groupStore.setSelectedGroup(null);
                }}
                className="mr-1 cursor-pointer p-1 sm:hidden"
                aria-label="Back to contacts"
              >
                <ChevronLeft className="size-6" />
              </button>
              {/* group avatar */}
              <div className="mr-2">
                <Avatar
                  address={groupWithMessages.group.adminAddress}
                  size={32}
                  displayName={groupWithMessages.group.name}
                  isGroup={true}
                  collapsed={true}
                />
              </div>
              <div className="flex flex-col">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                  <span>{groupWithMessages.group.name}</span>
                  <Users className="size-4 text-[var(--text-secondary)]" />
                  {isAdmin && <Crown className="size-4 text-amber-500" />}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  {groupWithMessages.group.members.length} members
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                if (groupWithMessages) {
                  setGroupInfoModalGroup(groupWithMessages.group);
                  openModal("group-info");
                }
              }}
              className="hover:bg-primary-bg/50 rounded-lg p-2 transition-colors"
              title="Group info"
            >
              <Info className="size-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* group messages */}
          <div
            className="bg-primary-bg flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-1 py-4 pb-8 sm:px-2"
            ref={groupMessagesRef}
          >
            {groupWithMessages.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-[var(--text-secondary)] italic">
                  Start the conversation in {groupWithMessages.group.name}
                </div>
              </div>
            ) : (
              <GroupMessagesList
                messages={groupWithMessages.messages}
                group={groupWithMessages.group}
              />
            )}
          </div>

          {/* group composer - uses same DirectComposer with groupId */}
          <DirectComposer groupId={selectedGroupId!} />
        </>
      )}

      {/* DIRECT VIEW */}
      {isDirectView && oneOnOneConversation && (
        <>
          <div className="flex h-[60px] items-center justify-between bg-[var(--secondary-bg)] px-4">
            {/* mobile back button */}
            <div className="flex items-center">
              <button
                onClick={() => {
                  setMobileView("contacts");
                  messageStore.setOpenedRecipient(null);
                }}
                className="mr-1 cursor-pointer p-1 sm:hidden"
                aria-label="Back to contacts"
              >
                <ChevronLeft className="size-6" />
              </button>
              <ContactMenu
                oneOnOneConversation={oneOnOneConversation}
                openedRecipient={openedRecipient}
                messageStore={messageStore}
                openModal={openModal}
                setOneOnOneConversation={setOneOnOneConversation}
              />
              <h3 className="ms-1 flex items-center truncate text-base font-semibold">
                {oneOnOneConversation.contact.name ? (
                  <span title={oneOnOneConversation.contact.name}>
                    {isMobile
                      ? truncateNickname(oneOnOneConversation.contact.name)
                      : oneOnOneConversation.contact.name}
                  </span>
                ) : (
                  <div className="flex items-center">
                    <div className="[&_span]:!text-base [&_span]:!leading-normal [&>*]:!align-baseline">
                      <KaspaAddress address={openedRecipient ?? ""} />
                    </div>
                  </div>
                )}
              </h3>
            </div>
          </div>

          <div
            className="bg-primary-bg flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-1 py-4 pb-8 sm:px-2"
            ref={messagesScrollRef}
          >
            <DirectsList
              oneOnOneConversation={oneOnOneConversation}
              lastOutgoing={lastOutgoing}
              lastIncoming={lastIncoming}
            />
          </div>
          <DirectComposer recipient={openedRecipient || undefined} />
        </>
      )}
    </div>
  );
};
