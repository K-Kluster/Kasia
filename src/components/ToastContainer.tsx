import { useToastStore } from "../store/toast.store";

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm
            ${
              toast.type === "success"
                ? "bg-green-100 text-green-900"
                : toast.type === "error"
                ? "bg-red-100 text-red-900"
                : toast.type === "warning"
                ? "bg-yellow-100 text-yellow-900"
                : "bg-blue-100 text-blue-900"
            }
            animate-fade-in`}
        >
          <span>
            {toast.type === "success" && "✔️"}
            {toast.type === "error" && "❌"}
            {toast.type === "warning" && "⚠️"}
            {toast.type === "info" && "ℹ️"}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="text-lg font-bold"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
