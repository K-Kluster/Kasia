import { FC, useState } from "react";
import { Menu, Search, X, Users } from "lucide-react";
import clsx from "clsx";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUiStore } from "../../store/ui.store";
import { useBroadcastStore } from "../../store/broadcast.store";
import { DesktopMenu } from "../Layout/DesktopMenu";
import { Contact } from "../../store/repository/contact.repository";
import { ContactList } from "./Directs/ContactList";
import { BroadcastList } from "./Broadcasts/BroadcastList";
import { useFeatureFlagsStore } from "../../store/featureflag.store";
import { ModeSelector } from "../ModeSelector";
import { HoldablePlusButton } from "./HoldablePlusButton";

interface SidebarSectionProps {
  onContactClicked: (contact: Contact) => void;
  onGroupClicked: (groupId: string) => void;
  onModeChange: (isBroadcastMode: boolean) => void;
  openedRecipient: string | null;
  walletAddress: string | undefined;
  walletId: string | undefined;
  mobileView: "contacts" | "messages";
  contactsCollapsed: boolean;
  setContactsCollapsed: (v: boolean) => void;
  setMobileView: (v: "contacts" | "messages") => void;
}

export const SidebarSection: FC<SidebarSectionProps> = ({
  onContactClicked,
  onGroupClicked,
  onModeChange,
  openedRecipient,
  walletAddress,
  walletId,
  mobileView,
  contactsCollapsed,
  setContactsCollapsed,
  setMobileView,
}) => {
  const collapsedW = "w-14";
  const isMobile = useIsMobile();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const { openModal } = useUiStore();
  const { isBroadcastMode } = useBroadcastStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const broadcastEnabled = useFeatureFlagsStore(
    (state) => state.flags.broadcast
  );

  const handleNewChat = () => {
    openModal("new-chat");
  };

  const handleNewBroadcast = () => {
    openModal("new-broadcast");
  };

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
          <div className="flex flex-1 items-center">
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
              <button
                onClick={() => {
                  if (searchQuery.length > 0) {
                    setSearchQuery("");
                    setShowSearch(!showSearch);
                  } else {
                    setShowSearch(!showSearch);
                  }
                }}
                className="hover:text-kas-primary hover:bg-primary-bg/50 absolute top-1/2 left-1 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded focus:outline-none active:scale-90 active:opacity-80"
                aria-label="Toggle search"
              >
                <Search className="size-6" />
              </button>
              <input
                type="text"
                placeholder={
                  isBroadcastMode ? "Search channels..." : "Search messages..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={clsx(
                  "bg-primary-bg focus:ring-kas-secondary/50 border-primary-border w-full rounded-lg border px-10 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 transition-all duration-300 ease-out focus:ring-2 focus:outline-none",
                  showSearch
                    ? "max-w-full opacity-100"
                    : "pointer-events-none max-w-0 overflow-hidden opacity-0"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 z-10 h-4 w-4 -translate-y-[15px] cursor-pointer text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {broadcastEnabled && !showSearch && (
                <ModeSelector
                  onModeChange={onModeChange}
                  isBroadcastMode={isBroadcastMode}
                  shouldShow={broadcastEnabled && !showSearch}
                />
              )}

              <HoldablePlusButton
                broadcastEnabled={broadcastEnabled}
                isBroadcastMode={isBroadcastMode}
                onNewChat={handleNewChat}
                onNewBroadcast={handleNewBroadcast}
              />
            </div>
          </div>
        ) : (
          /* Buttons when collapsed */
          <div className="flex w-full flex-col gap-2">
            <button
              onClick={() => openModal("new-group")}
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 transition-all hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80"
              title="New Group"
            >
              <Users className="mx-auto h-6 w-6" />
            </button>
            <HoldablePlusButton
              broadcastEnabled={broadcastEnabled}
              isBroadcastMode={isBroadcastMode}
              onNewChat={handleNewChat}
              onNewBroadcast={handleNewBroadcast}
              collapsed={true}
            />
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="bg-secondary-bg flex-1 overflow-y-auto">
        {isBroadcastMode ? (
          <BroadcastList
            searchQuery={searchQuery}
            contactsCollapsed={contactsCollapsed}
            setMobileView={setMobileView}
          />
        ) : (
          <ContactList
            searchQuery={searchQuery}
            onContactClicked={onContactClicked}
            onGroupClicked={onGroupClicked}
            openedRecipient={openedRecipient}
            contactsCollapsed={contactsCollapsed}
            setMobileView={setMobileView}
            isMobile={isMobile}
          />
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
