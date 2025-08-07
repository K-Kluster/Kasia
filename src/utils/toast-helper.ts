import { useToastStore } from "../store/toast.store";

const toastMethods = {
  success: (message: string, timeout?: number) =>
    useToastStore.getState().add("success", message, timeout),
  error: (message: string, timeout?: number) =>
    useToastStore.getState().add("error", message, timeout),
  info: (message: string, timeout?: number) =>
    useToastStore.getState().add("info", message, timeout),
  warning: (message: string, timeout?: number) =>
    useToastStore.getState().add("warning", message, timeout),
  removeAll: () => useToastStore.getState().removeAll(),
  remove: (id: string) => useToastStore.getState().remove(id),
};

export const toast = {
  ...toastMethods,
};
