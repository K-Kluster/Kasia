import { FC } from "react";

import {
  BroadcastMessage,
  useBroadcastStore,
} from "../../../store/broadcast.store";
import { MessageBubble } from "../Utilities";
import { useUiStore } from "../../../store/ui.store";
import { useWalletStore } from "../../../store/wallet.store";

type BroadcastDisplayProps = {
  message: BroadcastMessage;
  isOutgoing: boolean;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
};

export const BroadcastDisplay: FC<BroadcastDisplayProps> = ({
  message,
  isOutgoing,
  showTimestamp,
  groupPosition = "single",
}) => {
  const { openModal } = useUiStore();
  const { setSelectedParticipant } = useBroadcastStore();
  const { selectedNetwork } = useWalletStore();

  const handleAvatarClick = () => {
    setSelectedParticipant({
      address: message.senderAddress,
      nickname: message.senderAddress.slice(-2).toUpperCase(), // or get actual nickname if available
    });
    openModal("broadcast-participant-info");
  };

  return (
    <MessageBubble
      message={{
        senderAddress: message.senderAddress,
        content: message.content,
        timestamp: message.timestamp,
        transactionId: message.transactionId ?? undefined,
        status: message.status,
      }}
      isOutgoing={isOutgoing}
      showTimestamp={showTimestamp}
      groupPosition={groupPosition}
      network={selectedNetwork}
      onAvatarClick={handleAvatarClick}
    />
  );
};
