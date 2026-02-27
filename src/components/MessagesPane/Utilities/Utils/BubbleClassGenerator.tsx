import clsx from "clsx";
import { TransactionStatus } from "../../../../types/all";

type GroupPosition = "single" | "top" | "middle" | "bottom";
type BubbleClassOptions = {
  isOutgoing: boolean;
  groupPosition: GroupPosition;
  className?: string;
  noBubble?: boolean;
  status?: TransactionStatus;
  customBorderColor?: string;
};

export const generateBubbleClasses = ({
  isOutgoing,
  groupPosition,
  className,
  noBubble,
  status = "confirmed",
  customBorderColor,
}: BubbleClassOptions) => {
  if (noBubble) return;

  const bubbleClass = (() => {
    if (isOutgoing) {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tr-sm rounded-br-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tr-sm rounded-br-2xl";
      return "rounded-2xl rounded-br-sm";
    } else {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tl-sm rounded-bl-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tl-sm rounded-bl-2xl";
      return "rounded-2xl rounded-bl-sm";
    }
  })();

  const getBackgroundClass = () => {
    if (isOutgoing) {
      if (status === "pending")
        return "border border-[var(--button-primary)]/30 bg-[var(--button-primary)]/5";
      if (status === "failed")
        return "border border-[var(--accent-red)] bg-[var(--accent-red)]/10";
      return "border border-[var(--button-primary)] bg-[var(--button-primary)]/20";
    } else {
      if (customBorderColor) {
        return `border-2 bg-[var(--secondary-bg)]`;
      }
      return "bg-[var(--secondary-bg)]";
    }
  };

  return clsx(
    "relative z-0 sm:max-w-[70%] max-w-[90%] cursor-pointer px-4 py-1 text-left break-words hyphens-auto",
    getBackgroundClass(),
    bubbleClass,
    className
  );
};
