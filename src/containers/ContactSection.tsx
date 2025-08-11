import { FC, useState } from "react";
import { Menu, Search, Plus, X } from "lucide-react";
import clsx from "clsx";
import { ContactCard } from "../components/ContactCard";
import { useIsMobile } from "../hooks/useIsMobile";
import { useUiStore } from "../store/ui.store";
import { useMessagingStore } from "../store/messaging.store";
import { DesktopMenu } from "../components/Layout/DesktopMenu";
import { Contact } from "../store/repository/contact.repository";

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
  contacts: contacts,
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
  const [showSearch, setShowSearch] = useState(false);
  // order contacts by last activity (most recent first)
  const orderedContacts = contacts.sort((a, b) => {
    const conversationA = messageStore.oneOnOneConversations.find(
      (oooc) => oooc.contact.id === a.id
    );
    const conversationB = messageStore.oneOnOneConversations.find(
      (oooc) => oooc.contact.id === b.id
    );

    const lastEventA = conversationA?.events?.at(-1);
    const lastEventB = conversationB?.events?.at(-1);

    // if both have events, sort by most recent
    if (lastEventA?.createdAt && lastEventB?.createdAt) {
      return lastEventB.createdAt.getTime() - lastEventA.createdAt.getTime();
    }

    // if only one has events, prioritize the one with events
    if (lastEventA?.createdAt && !lastEventB?.createdAt) return -1;
    if (!lastEventA?.createdAt && lastEventB?.createdAt) return 1;

    // if neither has events, sort alphabetically by name or address
    const nameA = a.name?.trim() || a.kaspaAddress;
    const nameB = b.name?.trim() || b.kaspaAddress;
    return nameA.localeCompare(nameB);
  });

  // Search through all messages and contacts
  const searchResults = (() => {
    if (!searchQuery.trim()) return orderedContacts;
    const q = searchQuery.toLowerCase();
    const matches = new Map<string, Contact>();

    messageStore.oneOnOneConversations.forEach((oneOnOneConversation) => {
      oneOnOneConversation.events.forEach((event) => {
        if (event.content.includes(q)) {
          matches.set(
            oneOnOneConversation.contact.kaspaAddress,
            oneOnOneConversation.contact
          );
        }
      });
    });

    orderedContacts.forEach((contact) => {
      if (
        contact.name?.toLowerCase().includes(q) ||
        contact.kaspaAddress.toLowerCase().includes(q)
      ) {
        matches.set(contact.kaspaAddress, contact);
      }
    });

    return [...matches.values()];
  })();

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
                <Menu className="h-7 w-7 text-[var(--text-primary)]" />
              </button>
            )}
            <div className="relative flex-1">
              <Search
                className="hover:text-kas-primary absolute top-1/2 left-3 size-5 -translate-y-1/2 cursor-pointer text-gray-400 hover:scale-110"
                onClick={() => {
                  setShowSearch(!showSearch);
                }}
              />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={clsx(
                  "bg-primary-bg focus:ring-kas-secondary/50 border-primary-border w-full rounded-lg border px-10 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:ring-2 focus:outline-none",
                  showSearch ? "flex" : "hidden"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              aria-label="new chat"
              className="cursor-pointer rounded-full border border-[var(--button-primary)] bg-[var(--button-primary)]/20 p-1 text-[var(--button-primary)] hover:scale-110"
              onClick={onNewChatClicked}
            >
              <Plus className="size-4" />
            </button>
          </div>
        ) : (
          /* Plus button when collapsed */
          <div className="flex flex-1 justify-center">
            <button
              aria-label="new chat"
              className="cursor-pointer rounded-full border border-[var(--button-primary)] bg-[var(--button-primary)]/20 p-1 text-[var(--button-primary)] hover:scale-110"
              onClick={onNewChatClicked}
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Contacts list */}
      <div className="bg-secondary-bg flex-1 overflow-y-auto">
        {searchResults.length
          ? searchResults.map((contact, index) => (
              <ContactCard
                key={`contact-${contact.id}-${index}`}
                contact={contact}
                isSelected={contact.kaspaAddress === openedRecipient}
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
        <DesktopMenu
          contactsCollapsed={contactsCollapsed}
          setContactsCollapsed={setContactsCollapsed}
          isMobile={isMobile}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
};
