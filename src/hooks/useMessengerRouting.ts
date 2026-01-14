import { useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { useBroadcastStore } from "../store/broadcast.store";
import { useGroupStore } from "../store/group.store";
import { Contact } from "../store/repository/contact.repository";

// this is used to route between the modes (contacts and directs)
// and the content they show
export const useMessengerRouting = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { walletId, contactId, channelId, groupId } = params;

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const { selectedChannelName, setSelectedChannel, setIsBroadcastMode } =
    useBroadcastStore();

  // determine if we're in broadcast mode based on url
  const isCurrentlyInBroadcastMode = location.pathname.includes("/broadcasts");

  // helper function to find contact address from contactid
  const getContactAddressFromId = (contactId: string): string | null => {
    const contact = messageStore.oneOnOneConversations.find(
      (oooc) => oooc.contact.id === contactId
    );
    return contact?.contact.kaspaAddress || null;
  };

  // helper function to find channel name from channelid
  const getChannelNameFromId = (channelId: string): string | null => {
    const { channels } = useBroadcastStore.getState();
    const channel = channels.find((ch) => ch.id === channelId);
    return channel?.channelName || null;
  };

  // get the actual contact address from the url parameter
  const contactAddress = contactId ? getContactAddressFromId(contactId) : null;

  // get the actual channel name from the url parameter
  const channelName = channelId ? getChannelNameFromId(channelId) : null;

  useEffect(() => {
    setIsBroadcastMode(isCurrentlyInBroadcastMode);
  }, [isCurrentlyInBroadcastMode, setIsBroadcastMode]);

  // effect to sync selected contact with url and save to localstorage
  useEffect(() => {
    if (contactAddress && contactAddress !== messageStore.openedRecipient) {
      messageStore.setOpenedRecipient(contactAddress);

      // save to localstorage for persistence using wallet id (not address for privacy)
      const unlockedWalletId = walletStore.unlockedWallet?.id;
      if (unlockedWalletId && contactId) {
        localStorage.setItem(
          `kasia_last_opened_contact_${unlockedWalletId}`,
          contactId
        );
      }
    } else if (!contactAddress && messageStore.openedRecipient) {
      messageStore.setOpenedRecipient(null);
    }
  }, [
    contactAddress,
    contactId,
    messageStore.openedRecipient,
    messageStore,
    walletStore.unlockedWallet?.id,
  ]);

  // effect to sync selected group with url
  useEffect(() => {
    const { setSelectedGroup, selectedGroupId } = useGroupStore.getState();
    if (groupId && groupId !== selectedGroupId) {
      setSelectedGroup(groupId);
    } else if (!groupId && selectedGroupId) {
      setSelectedGroup(null);
    }
  }, [groupId]);

  // effect to sync selected channel with url
  useEffect(() => {
    if (channelName && channelName !== selectedChannelName) {
      setSelectedChannel(channelName);
    } else if (
      !channelName &&
      selectedChannelName &&
      isCurrentlyInBroadcastMode
    ) {
      setSelectedChannel(null);
    }
  }, [
    channelName,
    selectedChannelName,
    setSelectedChannel,
    isCurrentlyInBroadcastMode,
  ]);

  // effect to handle invalid contact/channel urls (redirect to fallback)
  useEffect(() => {
    if (!messageStore.isLoaded || !walletStore.isAccountServiceRunning) return;

    // check if contactid exists in conversations
    if (contactId && !isCurrentlyInBroadcastMode) {
      const contactExists = messageStore.oneOnOneConversations.some(
        (oooc) => oooc.contact.id === contactId
      );

      if (!contactExists) {
        console.warn(
          `Contact with ID ${contactId} not found, redirecting to directs`
        );
        navigate(`/${walletId}/directs`, { replace: true });
      }
    }

    // check if channelid exists in broadcast channels (for broadcast mode)
    if (channelId && isCurrentlyInBroadcastMode) {
      const { channels } = useBroadcastStore.getState();
      const channelExists = channels.some(
        (channel) => channel.id === channelId
      );

      if (!channelExists) {
        console.warn(
          `Broadcast channel with ID ${channelId} not found, redirecting to broadcasts`
        );
        navigate(`/${walletId}/broadcasts`, { replace: true });
      }
    }
  }, [
    contactId,
    channelId,
    isCurrentlyInBroadcastMode,
    messageStore.isLoaded,
    messageStore.oneOnOneConversations,
    walletStore.isAccountServiceRunning,
    navigate,
    walletId,
  ]);

  // effect to save selected channel id to localstorage for persistence
  useEffect(() => {
    if (channelId && selectedChannelName) {
      const unlockedWalletId = walletStore.unlockedWallet?.id;
      if (unlockedWalletId) {
        localStorage.setItem(
          `kasia_last_opened_channel_${unlockedWalletId}`,
          channelId
        );
      }
    }
  }, [channelId, selectedChannelName, walletStore.unlockedWallet?.id]);

  const onContactClicked = (contact: Contact) => {
    if (!walletStore.address) {
      console.error("No wallet address");
      return;
    }

    // navigate to the contact's url using contact id instead of address
    navigate(`/${walletId}/directs/${contact.id}`);
  };

  const onGroupClicked = (groupId: string) => {
    // navigate to the group's url
    navigate(`/${walletId}/directs/group/${groupId}`);
  };

  const onModeChange = (isBroadcastMode: boolean) => {
    setIsBroadcastMode(isBroadcastMode);

    if (isBroadcastMode) {
      navigate(`/${walletId}/broadcasts`);
    } else {
      navigate(`/${walletId}/directs`);
    }
  };

  return {
    walletId,
    contactId,
    channelId,
    groupId,
    contactAddress,
    channelName,
    isCurrentlyInBroadcastMode,
    onContactClicked,
    onGroupClicked,
    onModeChange,
  };
};
