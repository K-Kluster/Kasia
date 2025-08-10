import { FC, ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

// Basic modal component to standardise the look
// Pass in your children - this just provides the bare minimum
export const Modal: FC<{
  onClose: () => void;
  children: ReactNode;
  className?: string;
}> = ({ onClose, children, className }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleClose = () => {
    setMounted(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200",
        {
          "opacity-0": !mounted,
          "opacity-100": mounted,
        },
        className
      )}
      onClick={handleClose}
    >
      <div
        className={clsx(
          "border-primary-border bg-secondary-bg relative mx-4 w-full max-w-2xl rounded-2xl border p-6 transition-all duration-200",
          {
            "translate-y-0 opacity-100": mounted,
            "-translate-y-5 opacity-0": !mounted,
          }
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="hover:text-kas-secondary absolute top-2 right-2 z-60 cursor-pointer p-2 hover:scale-110"
        >
          <X className="bg-primary-bg border-primary-border h-7 w-7 rounded-3xl border p-1" />
        </button>
        {children}
      </div>
    </div>
  );
};
