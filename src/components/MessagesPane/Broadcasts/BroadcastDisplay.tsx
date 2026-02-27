import { FC, useState } from "react";
import clsx from "clsx";

import {
  BroadcastMessage,
  useBroadcastStore,
} from "../../../store/broadcast.store";
import {
  generateBubbleClasses,
  ExplorerLink,
  MessageTimestamp,
  MessageContent,
  generateAddressColor,
} from "../Utilities";
import { AvatarHash } from "../../icons/AvatarHash";
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
  const [showMeta, setShowMeta] = useState(false);
  const { openModal } = useUiStore();
  const { setSelectedParticipant } = useBroadcastStore();
  const { selectedNetwork } = useWalletStore();

  // Get the hex color for both bubble border and avatar overlay
  const customColor = !isOutgoing
    ? generateAddressColor(message.senderAddress)
    : undefined;

  const createdAtMs = message.timestamp.getTime();
  const isRecent = Date.now() - createdAtMs < 12 * 60 * 60 * 1000;
  const displayStamp = isRecent
    ? message.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : message.timestamp.toLocaleString();

  const renderTimestamp = () => {
    if (!showTimestamp && !showMeta) return null;
    return <MessageTimestamp timestamp={displayStamp} shouldUseBubble={true} />;
  };

  const handleAvatarClick = () => {
    setSelectedParticipant({
      address: message.senderAddress,
      nickname: message.senderAddress.slice(-2).toUpperCase(), // or get actual nickname if available
    });
    openModal("broadcast-participant-info");
  };

  return (
    <div
      className={clsx(
        "flex w-full",
        isOutgoing
          ? "justify-end pr-0.5 sm:pr-2"
          : "justify-start pl-0.5 sm:pl-2"
      )}
    >
      {/* Avatar for incoming messages */}
      {!isOutgoing && (
        <div
          className="relative top-1 mr-2 flex-shrink-0 cursor-pointer self-end transition-transform hover:scale-105"
          onClick={handleAvatarClick}
          title="Click to view participant info"
        >
          <AvatarHash
            address={message.senderAddress}
            size={36}
            className="rounded-full bg-[var(--secondary-bg)]"
            isGroup={true}
          />
          {/* overlay last 2 characters of address */}
          <span className="pointer-events-none absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-xs font-bold text-[var(--text-primary)] select-none">
            {message.senderAddress.slice(-2).toUpperCase()}
          </span>
        </div>
      )}

      {showMeta && message.transactionId && isOutgoing && (
        <ExplorerLink
          transactionId={message.transactionId}
          network={selectedNetwork}
          position="right"
        />
      )}

      <div
        onClick={() => setShowMeta((p) => !p)}
        style={customColor ? { borderColor: customColor } : undefined}
        className={clsx(
          "my-0.5 cursor-pointer text-base leading-relaxed",
          generateBubbleClasses({
            isOutgoing,
            groupPosition,
            status: message.status,
            customBorderColor: customColor,
          })
        )}
      >
        <MessageContent
          content={message.content}
          isDecrypting={false}
          isBroadcast={true}
          isOutgoing={isOutgoing}
        />
        {renderTimestamp()}
      </div>

      {showMeta && message.transactionId && !isOutgoing && (
        <ExplorerLink
          transactionId={message.transactionId}
          network={selectedNetwork}
          position="left"
        />
      )}
    </div>
  );
};
