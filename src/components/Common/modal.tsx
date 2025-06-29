import { FC, ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

// Basic modal component to standardise the look
// Pass in your children - this just provides the bare minimum
export const Modal: FC<{ onClose: () => void; children: ReactNode }> = ({
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onClick={onClose}
  >
    <div
      className="relative mx-4 w-full max-w-md rounded-lg bg-[var(--secondary-bg)] p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-60 cursor-pointer p-2 hover:scale-110 hover:text-white"
      >
        <XMarkIcon className="h-6 w-6 text-gray-200" />
      </button>
      {children}
    </div>
  </div>
);
