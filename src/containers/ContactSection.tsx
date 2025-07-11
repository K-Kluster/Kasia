import { FC, useState, useMemo } from "react";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import { ContactCard } from "../components/ContactCard";
import { Contact } from "../types/all";
import { useIsMobile } from "../utils/useIsMobile";
import { useUiStore } from "../store/ui.store";
import { useMessagingStore } from "../store/messaging.store";
import { MenuContainer } from "./MenuContainer";

interface ContactSectionProps {
  contacts: Contact[];
  onNewChatClicked: () => void;
  onContactClicked: (contact: Contact) => void;
  openedRecipient: string | null;
  walletAddress: string | undefined;
  mobileView: "contacts" | "messages";
  contactsCollapsed: boolean;
  setContactsCollapsed: (v: boolean) => void;
  setMobileView: (v: "contacts" | "messages") => void;
}

export const ContactSection: FC<ContactSectionProps> = ({
  contacts,
  onNewChatClicked,
  onContactClicked,
  openedRecipient,
  walletAddress,
  mobileView,
  contactsCollapsed,
  setContactsCollapsed,
  setMobileView,
}) => {
  const collapsedW = "w-14";
  const isMobile = useIsMobile();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const messageStore = useMessagingStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Search through all messages and contacts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    const matches = new Map<string, Contact>();

    messageStore.messages.forEach((message) => {
      const text =
        `${message.content ?? ""} ${message.payload ?? ""}`.toLowerCase();
      if (text.includes(q)) {
        const addr =
          message.senderAddress === walletAddress
            ? message.recipientAddress
            : message.senderAddress;
        const c = contacts.find((cc) => cc.address === addr);
        if (c) matches.set(c.address, c);
      }
    });

    contacts.forEach((contact) => {
      if (
        contact.nickname?.toLowerCase().includes(q) ||
        contact.address.toLowerCase().includes(q)
      ) {
        matches.set(contact.address, contact);
      }
    });

    return [...matches.values()];
  }, [searchQuery, contacts, messageStore.messages, walletAddress]);

  const uniqueContacts = [
    ...new Map(
      searchResults
        .filter((c) => c.address && c.address !== walletAddress)
        .map((c) => [c.address.trim().toLowerCase(), c])
    ).values(),
  ];

  const containerCls = clsx(
    "flex flex-col bg-bg-primary transition-all duration-200",
    contactsCollapsed ? collapsedW : "w-full sm:w-[200px] md:w-[280px]",
    isMobile && mobileView === "messages" && "hidden"
  );

  return (
    <div className={containerCls}>
      {/* header */}
      <div className="bg-secondary-bg flex h-[60px] items-center justify-between px-4 py-4">
        {/* Search bar and new chat button */}
        {!contactsCollapsed ? (
          <div className="flex flex-1 items-center gap-2">
            {/* Hamburger button for mobile */}
            {isMobile && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="hover:bg-primary-bg/50 mr-2 cursor-pointer rounded-lg p-2 transition-colors"
                aria-label="Open menu"
              >
                <Bars3Icon className="h-5 w-5 text-[var(--text-primary)]" />
              </button>
            )}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-primary-bg focus:ring-kas-secondary/50 w-full rounded-lg px-10 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:ring-2 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              aria-label="new chat"
              className="text-kas-secondary bg-kas-secondary/20 border-kas-secondary cursor-pointer rounded-full border p-1 hover:scale-110"
              onClick={onNewChatClicked}
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        ) : (
          /* Plus button when collapsed */
          <div className="flex flex-1 justify-center">
            <button
              aria-label="new chat"
              className="text-kas-secondary bg-kas-secondary/20 border-kas-secondary cursor-pointer rounded-full border p-1 hover:scale-110"
              onClick={onNewChatClicked}
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Contacts list */}
      <div className="bg-secondary-bg flex-1 overflow-y-auto">
        {uniqueContacts.length
          ? uniqueContacts.map((contact) => (
              <ContactCard
                key={contact.address}
                contact={contact}
                isSelected={contact.address === openedRecipient}
                collapsed={contactsCollapsed}
                onClick={() => {
                  onContactClicked(contact);
                  if (isMobile) setMobileView("messages");
                }}
              />
            ))
          : !contactsCollapsed && (
              <div className="m-5 overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
                {searchQuery ? "No search results" : "No Contacts Yet"}
              </div>
            )}
      </div>

      {/* Bottom controls (desktop only) */}
      {!isMobile && (
        <MenuContainer
          contactsCollapsed={contactsCollapsed}
          setContactsCollapsed={setContactsCollapsed}
          isMobile={isMobile}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
};
