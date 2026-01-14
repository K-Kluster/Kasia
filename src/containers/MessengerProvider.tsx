import { FC, useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router";
import { ErrorCard } from "../components/ErrorCard";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { useUiStore } from "../store/ui.store";
import { useBroadcastStore } from "../store/broadcast.store";
import { useComposerStore } from "../store/message-composer.store";
import { useLiveStore } from "../store/live.store";
import { useGroupStore } from "../store/group.store";
import { useMessengerRouting } from "../hooks/useMessengerRouting";
import { useMobileViewManager } from "../hooks/useMobileViewManager";
import { SidebarSection } from "../components/SideBarPane/SidebarSection";
import { LoadingMessages } from "../components/LoadingMessages";

export const MessengerProvider: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  // use routing hook for all url-related logic
  const {
    walletId,
    contactId,
    channelId,
    groupId,
    isCurrentlyInBroadcastMode,
    onContactClicked,
    onGroupClicked,
    onModeChange,
  } = useMessengerRouting();

  const isCurrentlyOnDirectsPage = location.pathname.includes("/directs");

  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  // use mobile view manager hook
  const { mobileView, setMobileView, isMobile } = useMobileViewManager(
    contactId,
    channelId,
    groupId,
    isCurrentlyInBroadcastMode,
    messageStore.isLoaded
  );

  // Ensure contacts are not collapsed on mobile
  useEffect(() => {
    if (isMobile && contactsCollapsed) {
      setContactsCollapsed(false);
    }
  }, [isMobile, contactsCollapsed]);

  const navigate = useNavigate();

  useEffect(() => {
    if (walletStore.unlockedWallet) setIsWalletReady(true);
  }, [walletStore.unlockedWallet]);

  // TODO: eventually refactor this and the UE below this one.
  // effect to restore last opened conversation after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      walletStore.isAccountServiceRunning &&
      isCurrentlyOnDirectsPage &&
      !contactId &&
      !groupId &&
      messageStore.oneOnOneConversations.length > 0
    ) {
      const unlockedWalletId = walletStore.unlockedWallet?.id;
      if (unlockedWalletId) {
        // get the last opened contact id from localstorage
        try {
          const lastOpenedContactId = localStorage.getItem(
            `kasia_last_opened_contact_${unlockedWalletId}`
          );

          if (lastOpenedContactId) {
            // check if the contact still exists
            const contactExists = messageStore.oneOnOneConversations.some(
              (oooc) => oooc.contact.id === lastOpenedContactId
            );

            if (contactExists) {
              navigate(`/${walletId}/directs/${lastOpenedContactId}`, {
                replace: true,
              });
              return;
            }
          }

          // fallback: select the first available contact
          const firstContact = messageStore.oneOnOneConversations[0]?.contact;
          if (firstContact) {
            navigate(`/${walletId}/directs/${firstContact.id}`, {
              replace: true,
            });
          }
        } catch (error) {
          console.error("Error restoring last opened contact:", error);
        }
      }
    }
  }, [
    messageStore.isLoaded,
    contactId,
    groupId,
    messageStore.oneOnOneConversations,
    walletStore.isAccountServiceRunning,
    walletStore.address,
    walletStore.unlockedWallet?.id,
    isMobile,
    isCurrentlyOnDirectsPage,
    navigate,
    walletId,
  ]);

  // effect to restore last opened broadcast channel after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      walletStore.isAccountServiceRunning &&
      !channelId &&
      isCurrentlyInBroadcastMode &&
      useBroadcastStore.getState().channels.length > 0
    ) {
      const unlockedWalletId = walletStore.unlockedWallet?.id;
      if (unlockedWalletId) {
        try {
          // get the last opened channel id from localstorage
          const lastOpenedChannelId = localStorage.getItem(
            `kasia_last_opened_channel_${unlockedWalletId}`
          );

          if (lastOpenedChannelId) {
            // check if the channel still exists
            const broadcastStore = useBroadcastStore.getState();
            const channelExists = broadcastStore.channels.some(
              (channel) => channel.id === lastOpenedChannelId
            );

            if (channelExists) {
              navigate(`/${walletId}/broadcasts/${lastOpenedChannelId}`, {
                replace: true,
              });
              return;
            }
          }

          // fallback: select the first available channel
          const firstChannel = useBroadcastStore.getState().channels[0];
          if (firstChannel) {
            navigate(`/${walletId}/broadcasts/${firstChannel.id}`, {
              replace: true,
            });
          }
        } catch (error) {
          console.error(
            "Error restoring last opened broadcast channel:",
            error
          );
        }
      }
    }
  }, [
    messageStore.isLoaded,
    channelId,
    isCurrentlyInBroadcastMode,
    walletStore.isAccountServiceRunning,
    walletStore.unlockedWallet?.id,
    isMobile,
    navigate,
    walletId,
  ]);

  // cleanup effect - only runs when leaving the entire messaging area
  useEffect(() => {
    return () => {
      const messageStore = useMessagingStore.getState();
      const walletStore = useWalletStore.getState();
      const uiStore = useUiStore.getState();
      const composerStore = useComposerStore.getState();
      const groupStore = useGroupStore.getState();

      messageStore.stop();
      groupStore.stop();
      walletStore.lock();
      uiStore.setSettingsOpen(false);
      uiStore.closeAllModals();
      messageStore.setOpenedRecipient(null);

      // clear broadcast store state when leaving messaging
      useBroadcastStore.getState().reset();
      useLiveStore.getState().stop();
      composerStore.setAttachment(null);
    };
  }, []);

  return (
    <>
      {/* Main Message Section*/}
      <div className="bg-primary-bg flex h-[100dvh] overflow-hidden sm:h-[calc(100vh-69px)] pointer-coarse:h-[calc(100dvh-var(--kb,0px))]">
        {isWalletReady &&
        messageStore.isLoaded &&
        walletStore.isAccountServiceRunning ? (
          <>
            <SidebarSection
              onContactClicked={onContactClicked}
              onGroupClicked={onGroupClicked}
              onModeChange={onModeChange}
              openedRecipient={messageStore.openedRecipient}
              walletAddress={walletStore.address?.toString()}
              walletId={walletId}
              mobileView={mobileView}
              contactsCollapsed={contactsCollapsed}
              setContactsCollapsed={setContactsCollapsed}
              setMobileView={(view) => {
                setMobileView(view);
                // when switching to contacts view on mobile, navigate back to the appropriate base route
                if (isMobile && view === "contacts") {
                  if (isCurrentlyInBroadcastMode) {
                    navigate(`/${walletId}/broadcasts`);
                  } else {
                    navigate(`/${walletId}/directs`);
                  }
                }
              }}
            />
            <Outlet />
          </>
        ) : isWalletReady ? (
          <LoadingMessages />
        ) : (
          <div className="flex w-full flex-col items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-lg font-semibold">Wallet not ready</p>
              <p className="text-text-primary text-sm">
                Please unlock your wallet first
              </p>
            </div>
          </div>
        )}
      </div>
      {/* global error section */}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </>
  );
};
