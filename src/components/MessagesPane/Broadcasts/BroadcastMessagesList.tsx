import { FC } from "react";
import { BroadcastMessage } from "../../../store/broadcast.store";
import { BroadcastDisplay } from "./BroadcastDisplay";
import { DateSeparator } from "../../DateSeparator";
import { isToday } from "../../../utils/message-date-format";
import { useBlocklistStore } from "../../../store/blocklist.store";

export const BLOCKED_PLACEHOLDER = "Blocked Contact";
interface BroadcastMessagesListProps {
  messages: BroadcastMessage[];
  walletAddress: string;
}

export const BroadcastMessagesList: FC<BroadcastMessagesListProps> = ({
  messages,
  walletAddress,
}) => {
  const blockedAddresses = useBlocklistStore((state) => state.blockedAddresses);
  const broadcastBlockedDisplayMode = useBlocklistStore(
    (state) => state.broadcastBlockedDisplayMode
  );

  // filter or map blocked messages based on display mode
  const processedMessages = messages
    .map((message) => {
      const isSenderBlocked = blockedAddresses.has(message.senderAddress);
      if (isSenderBlocked && broadcastBlockedDisplayMode === "hide") {
        return null; // hide completely
      }
      if (isSenderBlocked && broadcastBlockedDisplayMode === "placeholder") {
        return {
          ...message,
          content: BLOCKED_PLACEHOLDER,
          isBlockedPlaceholder: true,
        };
      }
      return { ...message, isBlockedPlaceholder: false };
    })
    .filter(Boolean) as (BroadcastMessage & {
    isBlockedPlaceholder: boolean;
  })[];

  if (!processedMessages.length) {
    return (
      <div className="m-5 rounded-xl bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
        No messages in this channel yet...
      </div>
    );
  }

  // compute last index of outgoing and messages from each sender
  const lastMessageIndices = new Map<string, number>();
  processedMessages.forEach((message, idx) => {
    lastMessageIndices.set(message.senderAddress, idx);
  });

  const firstTodayIdx = processedMessages.findIndex((message) =>
    isToday(message.timestamp)
  );

  return (
    <>
      {processedMessages.map((message, idx) => {
        const isFirst = idx === 0;
        const isOutgoing = message.senderAddress === walletAddress;
        const showTimestamp =
          idx === (lastMessageIndices.get(message.senderAddress) || -1);
        const previousMessage = processedMessages[idx - 1];
        const nextMessage = processedMessages[idx + 1];
        const dateObj = message.timestamp;

        // is this the first message of today?
        const isFirstToday = idx === firstTodayIdx && isToday(dateObj);

        // show date time stamp if:
        // - this is the first message of today
        // - or, this is not the first message and there's a 5min+ gap
        // - or, this is the first message
        const showSeparator =
          isFirstToday ||
          (idx > 0 &&
            previousMessage &&
            message.timestamp.getTime() - previousMessage.timestamp.getTime() >
              5 * 60 * 1000) ||
          (idx === 0 && !isToday(dateObj));

        // if there's a separator, treat as new group
        const isPrevSameSender =
          !showSeparator &&
          previousMessage &&
          previousMessage.senderAddress === message.senderAddress;
        const isNextSameSender =
          nextMessage &&
          // if the next message has a separator, it's not same group
          !(
            (idx + 1 === firstTodayIdx && isToday(nextMessage.timestamp)) ||
            (idx + 1 > 0 &&
              processedMessages[idx + 1 - 1] &&
              nextMessage.timestamp.getTime() -
                processedMessages[idx + 1 - 1].timestamp.getTime() >
                30 * 60 * 1000) ||
            (idx + 1 === 0 && !isToday(nextMessage.timestamp))
          ) &&
          nextMessage.senderAddress === message.senderAddress;

        const isSingleInGroup = !isPrevSameSender && !isNextSameSender;
        const isTopOfGroup = !isPrevSameSender && isNextSameSender;
        const isBottomOfGroup = isPrevSameSender && !isNextSameSender;

        return (
          <div
            key={message.transactionId || message.id}
            className={isFirst ? "mt-auto" : ""}
          >
            {showSeparator &&
              (isFirstToday ? (
                <div className="my-4 text-center text-xs text-gray-400">
                  Today
                  <br />
                  {dateObj.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              ) : (
                <DateSeparator timestamp={message.timestamp.getTime()} />
              ))}
            <BroadcastDisplay
              message={message}
              isOutgoing={isOutgoing}
              showTimestamp={showTimestamp}
              groupPosition={
                isSingleInGroup
                  ? "single"
                  : isTopOfGroup
                    ? "top"
                    : isBottomOfGroup
                      ? "bottom"
                      : "middle"
              }
            />
          </div>
        );
      })}
    </>
  );
};
