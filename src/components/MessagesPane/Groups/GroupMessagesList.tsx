import React from "react";
import { GroupMessage } from "../../../store/repository/group-message.repository";
import { Group } from "../../../store/repository/group.repository";
import { GroupMessageBubble } from "./GroupMessageBubble";
import { DateSeparator } from "../../DateSeparator";
import { isToday } from "../../../utils/message-date-format";

interface GroupMessagesListProps {
  messages: GroupMessage[];
  group: Group;
}

export const GroupMessagesList: React.FC<GroupMessagesListProps> = ({
  messages,
  group,
}) => {
  // compute last index per sender for persistent timestamps
  const lastMessageIndices = new Map<string, number>();
  messages.forEach((message, idx) => {
    lastMessageIndices.set(message.senderAddress, idx);
  });

  const firstTodayIdx = messages.findIndex((message) =>
    isToday(message.createdAt)
  );

  return (
    <div className="space-y-0.5">
      {messages.map((message, index) => {
        const previousMessage = messages[index - 1];
        const nextMessage = messages[index + 1];
        const dateObj = message.createdAt;

        const isFirstToday = index === firstTodayIdx && isToday(dateObj);
        const showSeparator =
          isFirstToday ||
          (index > 0 &&
            previousMessage &&
            message.createdAt.getTime() - previousMessage.createdAt.getTime() >
              30 * 60 * 1000) ||
          (index === 0 && !isToday(dateObj));

        const isPrevSameSender =
          !showSeparator &&
          previousMessage &&
          previousMessage.senderAddress === message.senderAddress;
        const isNextSameSender =
          nextMessage &&
          !(
            (index + 1 === firstTodayIdx && isToday(nextMessage.createdAt)) ||
            (index + 1 > 0 &&
              messages[index + 1 - 1] &&
              nextMessage.createdAt.getTime() -
                messages[index + 1 - 1].createdAt.getTime() >
                30 * 60 * 1000) ||
            (index + 1 === 0 && !isToday(nextMessage.createdAt))
          ) &&
          nextMessage.senderAddress === message.senderAddress;

        const isGroupedWithPrevious = !!isPrevSameSender;
        const isGroupedWithNext = !!isNextSameSender;

        // determine group position for bubble styling
        let groupPosition: "single" | "top" | "middle" | "bottom" = "single";
        if (isGroupedWithPrevious && isGroupedWithNext) {
          groupPosition = "middle";
        } else if (isGroupedWithPrevious) {
          groupPosition = "bottom";
        } else if (isGroupedWithNext) {
          groupPosition = "top";
        }

        return (
          <React.Fragment key={message.id}>
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
                <DateSeparator timestamp={message.createdAt.getTime()} />
              ))}

            <GroupMessageBubble
              message={message}
              group={group}
              showTimestamp={
                index === (lastMessageIndices.get(message.senderAddress) || -1)
              }
              groupPosition={groupPosition}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
