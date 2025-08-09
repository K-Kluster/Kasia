import { FC, memo } from "react";
import { MessageDisplay } from "./MessageDisplay";
import { OneOnOneConversation } from "../../types/all";
import { DateSeparator } from "../DateSeparator";
import { isToday } from "../../utils/message-date-format";

interface MessagesListProps {
  oneOnOneConversation: OneOnOneConversation;
  lastOutgoing: number;
  lastIncoming: number;
}

export const MessagesList: FC<MessagesListProps> = memo(
  ({ oneOnOneConversation, lastOutgoing, lastIncoming }) => {
    if (!oneOnOneConversation.events.length) {
      return (
        <div className="m-5 rounded-xl bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
          No messages in this conversation.
        </div>
      );
    }

    const firstTodayIdx = oneOnOneConversation.events.findIndex((event) =>
      isToday(event.createdAt)
    );

    console.log("message list - oooc", {
      oneOnOneConversation,
    });

    return (
      <>
        {oneOnOneConversation.events.map((event, idx) => {
          const isOutgoing = event.fromMe;
          const showTimestamp = isOutgoing
            ? idx === lastOutgoing
            : idx === lastIncoming;

          const previousEvent = oneOnOneConversation.events[idx - 1];
          const nextEvent = oneOnOneConversation.events[idx + 1];
          const dateObj = event.createdAt;

          // is this the first message of today?
          const isFirstToday = idx === firstTodayIdx && isToday(dateObj);

          // show date time stamp if:
          // - this is the first message of today
          // - or, this is not the first message and there's a 30min+ gap
          // - or, this is the first message
          const showSeparator =
            isFirstToday ||
            (idx > 0 &&
              previousEvent &&
              event.createdAt.getTime() - previousEvent.createdAt.getTime() >
                30 * 60 * 1000) ||
            (idx === 0 && !isToday(dateObj));

          // if there's a separator, treat as new group
          const isPrevSameSender =
            !showSeparator &&
            previousEvent &&
            previousEvent.fromMe === event.fromMe;
          const isNextSameSender =
            nextEvent &&
            // if the next message has a separator, it's not same group
            !(
              (idx + 1 === firstTodayIdx && isToday(nextEvent.createdAt)) ||
              (idx + 1 > 0 &&
                oneOnOneConversation.events[idx + 1 - 1] &&
                nextEvent.createdAt.getTime() -
                  oneOnOneConversation.events[idx + 1 - 1].createdAt.getTime() >
                  30 * 60 * 1000) ||
              (idx + 1 === 0 && !isToday(nextEvent.createdAt))
            ) &&
            nextEvent.fromMe === event.fromMe;

          const isSingleInGroup = !isPrevSameSender && !isNextSameSender;
          const isTopOfGroup = !isPrevSameSender && isNextSameSender;
          const isBottomOfGroup = isPrevSameSender && !isNextSameSender;
          return (
            <div key={event.transactionId}>
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
                  <DateSeparator timestamp={event.createdAt.getTime()} />
                ))}
              <MessageDisplay
                isOutgoing={isOutgoing}
                showTimestamp={showTimestamp}
                event={event}
                contact={oneOnOneConversation.contact}
                conversation={oneOnOneConversation.conversation}
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
