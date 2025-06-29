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

  return (
    <div
      className={clsx(
        "bg-[var(--primary-bg)] border-r border-[var(--border-color)] flex flex-col transition-all duration-200",
        contactsCollapsed ? collapsedW : "w-full sm:w-[200px] md:w-[280px]",
        mobileView === "messages" && "hidden sm:flex"
      )}
    >
      {/* header */}
      <div className="px-4 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--secondary-bg)] h-[60px]">
        {/* Chevron on desktop - we dont need for mobile */}
        {!isMobile ? (
          <button
            aria-label="toggle contacts pane"
            className="hidden sm:inline-flex cursor-pointer transition-transform hover:scale-110"
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
            className="p-2 rounded hover:bg-[var(--accent-blue)]/20 focus:outline-none"
            aria-label="Settings"
          >
            <Bars3Icon className="h-8 w-8 text-kas-primary animate-pulse" />
          </button>
        )}
        {!contactsCollapsed && (
          <>
            <span className="font-bold ml-2 flex-1 truncate">
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

      {/* Contacts list -  */}
      <div className="flex-1 overflow-y-auto p-2 bg-[var(--primary-bg)]">
        {contacts.filter((c) => c.address && c.address !== walletAddress)
          .length > 0
          ? contacts
              .filter((c) => c.address && c.address !== walletAddress)
              .map((c) => (
                <ContactCard
                  key={c.address}
                  contact={c}
                  isSelected={c.address === openedRecipient}
                  collapsed={contactsCollapsed} // signal to become an avatar
                  onClick={() => {
                    onContactClicked(c);
                    if (isMobile) setMobileView("messages");
                  }}
                />
              ))
          : !contactsCollapsed && (
              <div className="text-center text-[var(--text-secondary)] overflow-hidden py-10 px-5 italic bg-[rgba(0,0,0,0.2)] rounded-[12px] m-5">
                No Contacts Yet
              </div>
            )}
      </div>
    </div>
  );
};
