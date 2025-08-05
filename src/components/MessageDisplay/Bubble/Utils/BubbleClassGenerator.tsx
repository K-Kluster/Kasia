import clsx from "clsx";

type GroupPosition = "single" | "top" | "middle" | "bottom";

export const generateBubbleClasses = (
  isOutgoing: boolean,
  groupPosition: GroupPosition,
  className?: string,
  noBubble?: boolean
) => {
  if (noBubble) return;
  // determine the 'chat' style that we apply
  const bubbleClass = (() => {
    if (isOutgoing) {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tr-sm rounded-br-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tr-sm rounded-br-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-br-sm";
    } else {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tl-sm rounded-bl-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tl-sm rounded-bl-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-bl-sm";
    }
  })();

  return clsx(
    "relative z-0 mb-1 max-w-[70%] cursor-pointer px-4 py-1 text-left break-words hyphens-auto",
    isOutgoing
      ? "border border-[var(--button-primary)] bg-[var(--button-primary)]/20"
      : "bg-[var(--secondary-bg)]",
    bubbleClass,
    className
  );
};
