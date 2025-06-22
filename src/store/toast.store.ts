import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

const DEFAULT_TIMEOUTS: Record<ToastType, number> = {
  success: 5000,
  error: 10000,
  info: 5000,
  warning: 5000,
};

type ToastStore = {
  toasts: Toast[];
  add: (type: ToastType, message: string, timeout?: number) => void;
  remove: (id: string) => void;
  removeAll: () => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message, timeout) => {
    const id = Date.now().toString();
    const newToast = { id, type, message };
    const effectiveTimeout = timeout ?? DEFAULT_TIMEOUTS[type];

    set((state) => ({ toasts: [...state.toasts, newToast] }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, effectiveTimeout);
  },
  remove: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  removeAll: () => set({ toasts: [] }),
}));
