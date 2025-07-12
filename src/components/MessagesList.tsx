import { FC, memo } from "react";
import { MessageDisplay } from "./MessageDisplay";
import { Message } from "../types/all";

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
        <div className="m-5 rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
          No messages in this conversation.
        </div>
      );
    }

    return (
      <>
        {messages.map((msg, idx) => {
          const isOutgoing = msg.senderAddress === address;
          const showTimestamp = isOutgoing
            ? idx === lastOutgoing
            : idx === lastIncoming;

          return (
            <MessageDisplay
              key={msg.transactionId}
              isOutgoing={isOutgoing}
              showTimestamp={showTimestamp}
              message={msg}
            />
          );
        })}
      </>
    );
  }
);
