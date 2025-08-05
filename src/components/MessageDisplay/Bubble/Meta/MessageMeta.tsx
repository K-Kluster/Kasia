import { FC } from "react";
import clsx from "clsx";
import { FeeDisplay } from "./FeeDisplay";

type MessageMetaProps = {
  fee?: number;
  isOutgoing: boolean;
};

export const MessageMeta: FC<MessageMetaProps> = ({ fee, isOutgoing }) => {
  return (
    <div
      className={clsx(
        "mt-1.5 text-xs whitespace-nowrap opacity-80",
        isOutgoing
          ? "flex flex-col items-start space-y-1"
          : "flex flex-col items-start space-x-4 sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <FeeDisplay fee={fee} isOutgoing={isOutgoing} />
    </div>
  );
};
