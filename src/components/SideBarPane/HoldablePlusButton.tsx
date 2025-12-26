import { FC } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";

interface HoldablePlusButtonProps {
  broadcastEnabled: boolean;
  isBroadcastMode: boolean;
  onNewChat: () => void;
  onNewBroadcast: () => void;
  collapsed?: boolean;
}

export const HoldablePlusButton: FC<HoldablePlusButtonProps> = ({
  broadcastEnabled,
  isBroadcastMode,
  onNewChat,
  onNewBroadcast,
  collapsed = false,
}) => {
  const handleClick = () => {
    if (isBroadcastMode) {
      onNewBroadcast();
    } else {
      onNewChat();
    }
  };

  const buttonClasses = clsx(
    "hover:bg-primary-bg/50 hover:text-[var(--kas-primary)] cursor-pointer focus:outline-none active:scale-90 active:opacity-80 transition-all",
    collapsed ? "rounded p-2" : "rounded p-1"
  );

  return (
    <button
      onClick={handleClick}
      className={buttonClasses}
      aria-label={broadcastEnabled ? "new channel" : "new chat"}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
};
