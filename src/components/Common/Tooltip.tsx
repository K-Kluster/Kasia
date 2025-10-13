import { FC, ReactNode } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Info, LucideIcon } from "lucide-react";

interface TooltipProps {
  children: ReactNode;
  trigger?: string | LucideIcon;
  className?: string;
  position?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top start"
    | "top end"
    | "bottom start"
    | "bottom end"
    | "left start"
    | "left end"
    | "right start"
    | "right end";
}

export const Tooltip: FC<TooltipProps> = ({
  children,
  trigger = Info,
  className,
  position = "right start",
}) => {
  const renderTrigger = () => {
    if (typeof trigger === "string") {
      return (
        <span className="relative cursor-help text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
          {trigger}
        </span>
      );
    } else {
      const Icon = trigger;
      return (
        <Icon className="relative h-4 w-4 cursor-help text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" />
      );
    }
  };

  return (
    <Popover className="relative inline-block">
      <PopoverButton className="relative focus:outline-none">
        <span className="absolute inset-0 -m-2 rounded pointer-fine:hidden" />
        {renderTrigger()}
      </PopoverButton>
      <PopoverPanel
        anchor={position}
        className={`absolute z-50 mt-1 w-[40dvw] rounded-md bg-[var(--primary-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--primary-border)] ${className || ""}`}
      >
        {children}
      </PopoverPanel>
    </Popover>
  );
};
