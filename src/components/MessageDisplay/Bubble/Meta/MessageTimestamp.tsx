import { FC } from "react";
import clsx from "clsx";

type MessageTimestampProps = {
  timestamp: string;
  shouldUseBubble: boolean;
};

export const MessageTimestamp: FC<MessageTimestampProps> = ({
  timestamp,
  shouldUseBubble,
}) => {
  return (
    <div
      className={clsx(
        shouldUseBubble ? "mb-1.5" : "mt-1",
        "flex justify-end truncate text-xs"
      )}
    >
      <div className="opacity-70">{timestamp}</div>
    </div>
  );
};
