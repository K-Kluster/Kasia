import { FC } from "react";

type FeeDisplayProps = {
  fee?: number;
  isOutgoing: boolean;
  className?: string;
};

export const FeeDisplay: FC<FeeDisplayProps> = ({
  fee,
  isOutgoing,
  className = "message-fee text-right",
}) => {
  if (isOutgoing && fee !== undefined) {
    return (
      <div className="w-full">
        <div className={className}>Fee: {fee.toFixed(8)} KAS</div>
      </div>
    );
  }
  return null; // Don't show amount for any messages
};
