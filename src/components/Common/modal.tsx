import { FC, ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

// Basic modal component to standardise the look
// Pass in your children - this just provides the bare minimum
export const Modal: FC<{
  onClose: () => void;
  children: ReactNode;
  className?: string;
}> = ({ onClose, children, className }) => (
  <div
    className={clsx(
      "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
      className
    )}
    onClick={onClose}
  >
    <div
      className="border-primary-border bg-secondary-bg relative mx-4 w-full max-w-2xl rounded-2xl border p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="hover:text-kas-secondary absolute top-2 right-2 z-60 cursor-pointer p-2 hover:scale-110"
      >
        <X className="h-6 w-6" />
      </button>
      {children}
    </div>
  </div>
);
