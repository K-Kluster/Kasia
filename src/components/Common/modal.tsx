import { FC, ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

// Basic modal component to standardise the look
// Pass in your children - this just provides the bare minimum
export const Modal: FC<{ onClose: () => void; children: ReactNode }> = ({
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onClick={onClose}
  >
    <div
      className="relative bg-[var(--secondary-bg)] p-6 rounded-lg w-full max-w-md mx-4"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-2 cursor-pointer hover:text-white hover:scale-110 z-60"
      >
        <XMarkIcon className="h-6 w-6 text-gray-200" />
      </button>
      {children}
    </div>
  </div>
);

