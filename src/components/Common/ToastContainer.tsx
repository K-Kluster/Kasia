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
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm animate-fade-in",
            {
              "bg-green-100/80 text-green-900": toast.type === "success",
              "bg-red-100/80 text-red-900": toast.type === "error",
              "bg-yellow-100/80 text-yellow-900": toast.type === "warning",
              "bg-blue-100/80 text-blue-900": toast.type === "info",
            }
          )}
        >
          <span className="w-6 h-6">
            {toast.type === "success" && <CheckCircleIcon />}
            {toast.type === "error" && <XCircleIcon />}
            {toast.type === "warning" && <ExclamationTriangleIcon />}
            {toast.type === "info" && <InformationCircleIcon />}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
