import { FC } from "react";
import { useNavigate } from "react-router";
import { BroadcastSection } from "../components/MessagesPane/BroadcastSection";
import { useMessengerRouting } from "../hooks/useMessengerRouting";
import { useMobileViewManager } from "../hooks/useMobileViewManager";
import { useMessagingStore } from "../store/messaging.store";

export const BroadcastsContainer: FC = () => {
  const navigate = useNavigate();
  const {
    walletId,
    contactId,
    channelId,
    groupId,
    isCurrentlyInBroadcastMode,
  } = useMessengerRouting();
  const messageStore = useMessagingStore();

  const { mobileView, setMobileView, isMobile } = useMobileViewManager(
    contactId,
    channelId,
    groupId,
    isCurrentlyInBroadcastMode,
    messageStore.isLoaded
  );

  return (
    <BroadcastSection
      mobileView={mobileView}
      setMobileView={(view) => {
        setMobileView(view);
        // when switching to contacts view on mobile, navigate back to broadcast base route
        if (isMobile && view === "contacts") {
          navigate(`/${walletId}/broadcasts`);
        }
      }}
    />
  );
};
