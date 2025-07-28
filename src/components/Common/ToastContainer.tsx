import { useToastStore } from "../../store/toast.store";
import { CircleCheck, Ban, TriangleAlert, Info } from "lucide-react";

import clsx from "clsx";

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed top-16 right-4 z-60 max-w-5/6 space-y-2 break-all sm:top-4 sm:max-w-1/2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "animate-fade-in flex items-center gap-2 rounded-xl px-2 py-1 text-sm break-words shadow-lg sm:px-4 sm:py-3",
            {
              "bg-[var(--accent-green)]/80 text-white":
                toast.type === "success",
              "bg-[var(--accent-red)]/80 text-white": toast.type === "error",
              "bg-[var(--accent-yellow)]/80 text-white":
                toast.type === "warning",
              "bg-[var(--accent-blue)]/80 text-white": toast.type === "info",
            }
          )}
        >
          <span className="h-6 w-6 flex-shrink-0">
            {toast.type === "success" && <CircleCheck />}
            {toast.type === "error" && <Ban />}
            {toast.type === "warning" && <TriangleAlert />}
            {toast.type === "info" && <Info />}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="flex-shrink-0 cursor-pointer text-lg font-bold transition-opacity hover:opacity-70"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
