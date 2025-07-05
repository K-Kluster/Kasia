import { useToastStore } from "../../store/toast.store";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="sm:5/6 fixed top-16 right-4 z-60 max-w-1/2 space-y-2 break-all sm:top-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "animate-fade-in flex items-center gap-2 rounded-xl px-2 py-1 text-sm break-words shadow-lg sm:px-4 sm:py-3",
            {
              "bg-green-100/80 text-green-900": toast.type === "success",
              "bg-red-100/80 text-red-900": toast.type === "error",
              "bg-yellow-100/80 text-yellow-900": toast.type === "warning",
              "bg-blue-100/70 text-gray-700": toast.type === "info",
            }
          )}
        >
          <span className="h-6 w-6">
            {toast.type === "success" && <CheckCircleIcon />}
            {toast.type === "error" && <XCircleIcon />}
            {toast.type === "warning" && <ExclamationTriangleIcon />}
            {toast.type === "info" && <InformationCircleIcon />}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="cursor-pointer text-lg font-bold"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
