import { FC, memo } from "react";
import { MessageDisplay } from "./MessageDisplay";
import { Message } from "../types/all";
import { DateSeparator } from "./DateSeparator";
import { isToday } from "../utils/message-date-format";

interface MessagesListProps {
  messages: Message[];
  address: string | null;
  lastOutgoing: number;
  lastIncoming: number;
}

export const MessagesList: FC<MessagesListProps> = memo(
  ({ messages, address, lastOutgoing, lastIncoming }) => {
    if (!messages.length) {
      return (
        <div className="m-5 rounded-xl bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
          No messages in this conversation.
        </div>
      );
    }

    const firstTodayIdx = messages.findIndex((msg) =>
      isToday(new Date(msg.timestamp))
    );

    return (
      <>
        {messages.map((msg, idx) => {
          const isOutgoing = msg.senderAddress === address;
          const showTimestamp = isOutgoing
            ? idx === lastOutgoing
            : idx === lastIncoming;

          const prevMsg = messages[idx - 1];
          const nextMsg = messages[idx + 1];
          const dateObj = new Date(msg.timestamp);

          // is this the first message of today?
          const isFirstToday = idx === firstTodayIdx && isToday(dateObj);

          // show date time stamp if:
          // - this is the first message of today
          // - or, this is not the first message and there's a 30min+ gap
          // - or, this is the first message
          const showSeparator =
            isFirstToday ||
            (idx > 0 &&
              prevMsg &&
              msg.timestamp - prevMsg.timestamp > 30 * 60 * 1000) ||
            (idx === 0 && !isToday(dateObj));

          // if there's a separator, treat as new group
          const isPrevSameSender =
            !showSeparator &&
            prevMsg &&
            prevMsg.senderAddress === msg.senderAddress;
          const isNextSameSender =
            nextMsg &&
            // if the next message has a separator, it's not same group
            !(
              (idx + 1 === firstTodayIdx &&
                isToday(new Date(nextMsg.timestamp))) ||
              (idx + 1 > 0 &&
                messages[idx + 1 - 1] &&
                nextMsg.timestamp - messages[idx + 1 - 1].timestamp >
                  30 * 60 * 1000) ||
              (idx + 1 === 0 && !isToday(new Date(nextMsg.timestamp)))
            ) &&
            nextMsg.senderAddress === msg.senderAddress;

          const isSingleInGroup = !isPrevSameSender && !isNextSameSender;
          const isTopOfGroup = !isPrevSameSender && isNextSameSender;
          const isBottomOfGroup = isPrevSameSender && !isNextSameSender;

          return (
            <div key={msg.transactionId}>
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
                  <DateSeparator timestamp={msg.timestamp} />
                ))}
              <MessageDisplay
                isOutgoing={isOutgoing}
                showTimestamp={showTimestamp}
                message={msg}
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
  }
);
