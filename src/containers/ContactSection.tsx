import { FC } from "react";
import {
  ChevronLeftIcon,
  PlusIcon,
  Bars3Icon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import { ContactCard } from "../components/ContactCard";
import { Contact } from "../types/all";
import { useIsMobile } from "../utils/useIsMobile";
import { useUiStore } from "../store/ui.store";

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
  const toggleSettings = useUiStore((s) => s.toggleSettings);

  const uniqueContacts = [
    ...new Map(
      contacts
        .filter((c) => c.address && c.address !== walletAddress)
        .map((c) => [c.address.trim().toLowerCase(), c])
    ).values(),
  ];

  return (
    <div
      className={clsx(
        "flex flex-col border-r border-[var(--border-color)] bg-[var(--primary-bg)] transition-all duration-200",
        contactsCollapsed ? collapsedW : "w-full sm:w-[200px] md:w-[280px]",
        mobileView === "messages" && "hidden sm:flex"
      )}
    >
      {/* header */}
      <div className="flex h-[60px] items-center justify-between border-b border-[var(--border-color)] bg-[var(--secondary-bg)] px-4 py-4">
        {/* Chevron on desktop - we dont need for mobile */}
        {!isMobile ? (
          <button
            aria-label="toggle contacts pane"
            className="hidden cursor-pointer transition-transform hover:scale-110 sm:inline-flex"
            onClick={() => {
              if (isMobile) return;
              setContactsCollapsed(!contactsCollapsed);
            }}
          >
            <ChevronLeftIcon
              className={clsx(contactsCollapsed && "rotate-180", "size-6")}
            />
          </button>
        ) : (
          <button
            onClick={toggleSettings}
            className="rounded p-2 hover:bg-[var(--accent-blue)]/20 focus:outline-none"
            aria-label="Settings"
          >
            <Bars3Icon className="text-kas-primary h-8 w-8 animate-pulse" />
          </button>
        )}
        {!contactsCollapsed && (
          <>
            <span className="ml-2 flex-1 truncate font-bold">
              Conversations
            </span>
            <button
              aria-label="new chat"
              className="text-kas-secondary cursor-pointer hover:scale-110"
              onClick={onNewChatClicked}
            >
              <PlusIcon className="size-8" />
            </button>
          </>
        )}
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto bg-[var(--primary-bg)] p-2">
        {uniqueContacts.length > 0
          ? uniqueContacts.map((c) => (
              <ContactCard
                key={c.address}
                contact={c}
                isSelected={c.address === openedRecipient}
                collapsed={contactsCollapsed}
                onClick={() => {
                  onContactClicked(c);
                  if (isMobile) setMobileView("messages");
                }}
              />
            ))
          : !contactsCollapsed && (
              <div className="m-5 overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
                No Contacts Yet
              </div>
            )}
      </div>
    </div>
  );
};
