import { FC, ReactNode, useState } from "react";
import clsx from "clsx";
import { ExplorerLink } from "./Meta/ExplorerLink";
import { MessageTimestamp } from "./Meta/MessageTimestamp";
import { MessageContent } from "./Content/MessageContent";
import { generateAddressColor } from "./Utils/bubble-color-generator";
import { generateBubbleClasses } from "./Utils/BubbleClassGenerator";
import { AvatarHash } from "../../icons/AvatarHash";

type BubbleMessage = {
  senderAddress: string;
  content: string;
  timestamp: Date;
  transactionId?: string;
  status?: "pending" | "confirmed" | "failed";
};

type MessageBubbleProps = {
  message: BubbleMessage;
  isOutgoing: boolean;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
  network?: string;
  showAvatar?: boolean;
  useCustomColor?: boolean;
  noBubble?: boolean;
  timestampInBubble?: boolean;
  onAvatarClick?: () => void;
  renderContent?: () => ReactNode;
  renderFooter?: (context: {
    showMeta: boolean;
    showTimestamp: boolean;
  }) => ReactNode;
  renderMetaLeft?: ReactNode;
  renderMetaRight?: ReactNode;
};

export const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  showTimestamp = false,
  groupPosition = "single",
  network,
  showAvatar = true,
  useCustomColor = true,
  noBubble = false,
  timestampInBubble,
  onAvatarClick,
  renderContent,
  renderFooter,
  renderMetaLeft,
  renderMetaRight,
}) => {
  const [showMeta, setShowMeta] = useState(false);

  const customColor =
    !isOutgoing && useCustomColor && !noBubble
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

  return (
    <div
      className={clsx(
        "flex w-full",
        isOutgoing
          ? "justify-end pr-0.5 sm:pr-2"
          : "justify-start pl-0.5 sm:pl-2"
      )}
    >
      {!isOutgoing && showAvatar && (
        <div
          className="relative top-1 mr-2 flex-shrink-0 cursor-pointer self-end transition-transform hover:scale-105"
          onClick={onAvatarClick}
          title="Click to view participant info"
        >
          <AvatarHash
            address={message.senderAddress}
            size={36}
            className="rounded-full bg-[var(--secondary-bg)]"
            isGroup={true}
          />
          <span className="pointer-events-none absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-xs font-bold text-[var(--text-primary)] select-none">
            {message.senderAddress.slice(-2).toUpperCase()}
          </span>
        </div>
      )}

      {showMeta && isOutgoing && (
        <>
          {renderMetaRight}
          {message.transactionId && network && (
            <ExplorerLink
              transactionId={message.transactionId}
              network={network}
              position="right"
            />
          )}
        </>
      )}

      <div
        onClick={() => setShowMeta((prev) => !prev)}
        style={customColor ? { borderColor: customColor } : undefined}
        className={clsx(
          "my-0.5 cursor-pointer text-base leading-relaxed",
          generateBubbleClasses({
            isOutgoing,
            groupPosition,
            status: message.status,
            customBorderColor: customColor,
            noBubble,
          })
        )}
      >
        {(() => {
          if (renderContent) {
            const rendered = renderContent();
            if (rendered !== undefined && rendered !== null) {
              return rendered;
            }
          }

          return (
            <MessageContent
              content={message.content}
              isDecrypting={false}
              isOutgoing={isOutgoing}
            />
          );
        })()}
        {(showMeta || showTimestamp) && (
          <MessageTimestamp
            timestamp={displayStamp}
            shouldUseBubble={timestampInBubble ?? !noBubble}
          />
        )}
        {renderFooter ? renderFooter({ showMeta, showTimestamp }) : null}
      </div>

      {showMeta && !isOutgoing && (
        <>
          {message.transactionId && network && (
            <ExplorerLink
              transactionId={message.transactionId}
              network={network}
              position="left"
            />
          )}
          {renderMetaLeft}
        </>
      )}
    </div>
  );
};
