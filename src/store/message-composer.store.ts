import { create } from "zustand";
import { PriorityFeeConfig } from "../types/all";
import { FeeSource } from "kaspa-wasm";

// attachment types
export interface BaseAttachment {
  name: string;
  mime: string;
  data: string;
  size: number;
}

export interface FileAttachment extends BaseAttachment {
  type: "file";
}

export interface ImageAttachment extends BaseAttachment {
  type: "image";
  width?: number;
  height?: number;
}

export type Attachment = FileAttachment | ImageAttachment | null;

interface ComposerState {
  draft: string;
  attachment: Attachment | null;
  priority: PriorityFeeConfig;

  feeState: {
    status: "idle" | "loading" | "error";
    error?: Error;
    value?: number;
  };
  sendState: { status: "idle" | "loading" | "error"; error?: Error };

  // actions
  setDraft: (draft: string) => void;
  setAttachment: (attachment: Attachment | null) => void;
  setPriority: (priority: PriorityFeeConfig) => void;
  setFeeState: (state: {
    status: "idle" | "loading" | "error";
    error?: Error;
    value?: number;
  }) => void;
  setSendState: (state: {
    status: "idle" | "loading" | "error";
    error?: Error;
  }) => void;
  reset: () => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  draft: "",
  attachment: null,
  priority: { amount: 0n, source: FeeSource.SenderPays },
  feeState: { status: "idle" },
  sendState: { status: "idle" },

  setDraft: (draft) => set({ draft }),
  setAttachment: (attachment) => set({ attachment }),
  setPriority: (priority) => set({ priority }),
  setFeeState: (feeState) => set({ feeState }),
  setSendState: (sendState) => set({ sendState }),
  reset: () =>
    set({
      draft: "",
      attachment: null,
      priority: { amount: 0n, source: FeeSource.SenderPays },
      feeState: { status: "idle" },
      sendState: { status: "idle" },
    }),
}));

// selector helper
export const useComposerSlice = <T>(selector: (state: ComposerState) => T) =>
  useComposerStore(selector);
