import { FC, useState, useMemo } from "react";
import {
  ChevronLeftIcon,
  PlusIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowLongLeftIcon,
  Bars3BottomLeftIcon,
  InformationCircleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowPathIcon,
  CreditCardIcon,
} from "@heroicons/react/24/solid";
import { PanelLeftOpen, Settings } from "lucide-react";
import clsx from "clsx";
import { ContactCard } from "../components/ContactCard";
import { Contact } from "../types/all";
import { useIsMobile } from "../utils/useIsMobile";
import { useUiStore } from "../store/ui.store";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { SettingsModal } from "../components/Modals/SettingsModal";

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
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const openModal = useUiStore((s) => s.openModal);
  const messageStore = useMessagingStore();
  const lockWallet = useWalletStore((s) => s.lock);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Search through all messages and contacts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const query = searchQuery.toLowerCase();
    const allMessages = messageStore.messages;

    // Search through messages and find unique contacts that match
    const matchingContacts = new Map<string, Contact>();

    allMessages.forEach((message) => {
      const messageContent = message.content?.toLowerCase() || "";
      const messagePayload = message.payload?.toLowerCase() || "";

      if (messageContent.includes(query) || messagePayload.includes(query)) {
        // Find the contact for this message
        const otherParty =
          message.senderAddress === walletAddress
            ? message.recipientAddress
            : message.senderAddress;

        const contact = contacts.find((c) => c.address === otherParty);
        if (contact && !matchingContacts.has(contact.address)) {
          matchingContacts.set(contact.address, contact);
        }
      }
    });

    // Also search through contact nicknames and addresses
    contacts.forEach((contact) => {
      const nickname = contact.nickname?.toLowerCase() || "";
      const address = contact.address.toLowerCase();

      if (nickname.includes(query) || address.includes(query)) {
        matchingContacts.set(contact.address, contact);
      }
    });

    return Array.from(matchingContacts.values());
  }, [searchQuery, contacts, messageStore.messages, walletAddress]);

  const uniqueContacts = [
    ...new Map(
      searchResults
        .filter((c) => c.address && c.address !== walletAddress)
        .map((c) => [c.address.trim().toLowerCase(), c])
    ).values(),
  ];

  const onClearHistory = () => {
    if (!walletAddress) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(walletAddress);
    }
  };

  const finalClassName = clsx(
    "flex flex-col bg-bg-primary transition-all duration-200",
    contactsCollapsed ? collapsedW : "w-full sm:w-[200px] md:w-[280px]",
    isMobile && mobileView === "messages" ? "hidden" : ""
  );

  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);

  return (
    <div className={finalClassName}>
      {/* header */}
      <div className="bg-secondary-bg flex h-[60px] items-center justify-between px-4 py-4">
        {/* Search bar and new chat button */}
        {!contactsCollapsed ? (
          <div className="flex flex-1 items-center gap-2">
            {/* Hamburger button for mobile */}
            {isMobile && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="hover:bg-primary-bg/50 mr-2 rounded-lg p-2 transition-colors"
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
                  className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                {searchQuery ? "No search results" : "No Contacts Yet"}
              </div>
            )}
      </div>

      {/* Bottom controls - only show on desktop */}
      {!isMobile && (
        <div className="border-primary-border bg-secondary-bg border-t p-2">
          <div
            className={clsx(
              "flex gap-2",
              contactsCollapsed
                ? "flex-col items-center"
                : "flex-row items-center"
            )}
          >
            <button
              aria-label="toggle contacts pane"
              className="hover:bg-primary-bg/50 rounded p-2 transition-colors"
              onClick={() => setContactsCollapsed(!contactsCollapsed)}
            >
              <PanelLeftOpen
                className={clsx(contactsCollapsed && "rotate-180", "size-5")}
              />
            </button>
            <div
              className={clsx(
                "relative",
                contactsCollapsed
                  ? "flex flex-col items-center gap-2"
                  : "flex items-center gap-2"
              )}
            >
              {/* Wallet Icon and Menu */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (!isMobile) {
                    setWalletMenuOpen(true);
                    setSettingsOpen(false);
                  }
                }}
                onMouseLeave={() => {
                  if (!isMobile) setWalletMenuOpen(false);
                }}
              >
                <button
                  onClick={() => {
                    if (isMobile) {
                      setWalletMenuOpen((v) => !v);
                      setSettingsOpen(false);
                    }
                  }}
                  className="hover:bg-primary-bg/50 rounded p-2 focus:outline-none"
                  aria-label="Wallet Operations"
                >
                  <CreditCardIcon className="h-5 w-5" />
                </button>
                {walletMenuOpen && (
                  <>
                    {/* Invisible bridge to prevent menu from closing when moving mouse up */}
                    <div
                      className="absolute bottom-full left-0 z-10 h-2 w-56"
                      onMouseEnter={() => {
                        if (!isMobile) setWalletMenuOpen(true);
                      }}
                    />
                    <div
                      className="border-primary-border absolute bottom-full left-0 z-10 mb-2 w-56 rounded border bg-[var(--primary-bg)] shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => {
                        if (!isMobile) setWalletMenuOpen(true);
                      }}
                      onMouseLeave={() => {
                        if (!isMobile) setWalletMenuOpen(false);
                      }}
                    >
                      <ul className="divide-primary-border divide-y">
                        {/* Show Address Item */}
                        <li
                          onClick={() => {
                            openModal("address");
                            setWalletMenuOpen(false);
                          }}
                          className={clsx(
                            "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                            { "pointer-events-none opacity-50": !walletAddress }
                          )}
                        >
                          <UserIcon className="h-5 w-5" />
                          <span className="flex items-center text-sm">
                            Show Address
                            {!walletAddress && (
                              <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                            )}
                          </span>
                        </li>
                        {/* Wallet Info Item */}
                        <li
                          onClick={() => {
                            openModal("walletInfo");
                            setWalletMenuOpen(false);
                          }}
                          className={clsx(
                            "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                            { "pointer-events-none opacity-50": !walletAddress }
                          )}
                        >
                          <InformationCircleIcon className="h-5 w-5" />
                          <span className="flex items-center text-sm">
                            Wallet Info
                            {!walletAddress && (
                              <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                            )}
                          </span>
                        </li>
                        {/* Withdraw Funds */}
                        <li
                          onClick={() => {
                            openModal("withdraw");
                            setWalletMenuOpen(false);
                          }}
                          className="hover:bg-secondary-bg cursor-pointer px-4 py-3"
                        >
                          <span className="text-sm">Withdraw Funds</span>
                        </li>
                        {/* Compound UTXOs */}
                        <li
                          onClick={() => {
                            openModal("utxo-compound");
                            setWalletMenuOpen(false);
                          }}
                          className="hover:bg-secondary-bg cursor-pointer px-4 py-3"
                        >
                          <span className="text-sm">Compound UTXOs</span>
                        </li>
                        {/* Import / Export Messages */}
                        {messageStore.isLoaded && (
                          <li
                            onClick={() => {
                              openModal("backup");
                              setWalletMenuOpen(false);
                            }}
                            className="hover:bg-secondary-bg cursor-pointer px-4 py-3"
                          >
                            <span className="text-sm">
                              Import / Export <br /> Messages
                            </span>
                          </li>
                        )}
                        {/* Delete All Messages */}
                        <li
                          onClick={onClearHistory}
                          className="hover:bg-secondary-bg cursor-pointer px-4 py-3"
                        >
                          <span className="text-sm">Delete All Messages</span>
                        </li>
                        {/* View Seed Phrase */}
                        <li
                          onClick={() => {
                            openModal("seed");
                            setWalletMenuOpen(false);
                          }}
                          className="hover:bg-secondary-bg cursor-pointer px-4 py-3"
                        >
                          <span className="text-sm">View Seed Phrase</span>
                        </li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
              {/* Settings Icon and Modal */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="hover:bg-primary-bg/50 rounded p-2 focus:outline-none"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <SettingsModal
                  isOpen={showSettingsModal}
                  onClose={() => setShowSettingsModal(false)}
                />
              </div>
            </div>
          </div>

          {/* Close wallet button in separate row */}
          <div
            className={clsx(
              "mt-2",
              contactsCollapsed ? "flex justify-center" : "flex items-center"
            )}
          >
            <button
              onClick={lockWallet}
              className={clsx(
                "hover:bg-primary-bg/50 flex items-center gap-2 rounded p-2 transition-colors focus:outline-none",
                contactsCollapsed ? "flex-col" : "flex-row"
              )}
              aria-label="Sign out"
            >
              <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
              {!contactsCollapsed && (
                <span className="text-sm text-red-500">Sign out</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
