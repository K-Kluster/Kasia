import { create } from "zustand";
import { PriorityFeeConfig } from "../types/all";
import { FeeSource } from "kaspa-wasm";
import { FileData } from "./repository/message.repository";

export type Attachment = FileData | null;

interface ComposerState {
  drafts: Record<string, string>;
  attachment: Attachment | null;
  priority: PriorityFeeConfig;

  sendState: { status: "idle" | "loading" | "error"; error?: Error };

  // actions
  setDraft: (recipient: string, draft: string) => void;
  setAttachment: (attachment: Attachment | null) => void;
  setPriority: (priority: PriorityFeeConfig) => void;
  setSendState: (state: {
    status: "idle" | "loading" | "error";
    error?: Error;
  }) => void;
  getDraft: (recipient: string) => string;
  clearDraft: (recipient: string) => void;
  reset: () => void;
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  drafts: {},
  attachment: null,
  priority: { amount: 0n, source: FeeSource.SenderPays },
  sendState: { status: "idle" },

  setDraft: (recipient, draft) =>
    set((state) => ({
      drafts: { ...state.drafts, [recipient]: draft },
    })),
  setAttachment: (attachment) => set({ attachment }),
  setPriority: (priority) => set({ priority }),
  setSendState: (sendState) => set({ sendState }),
  getDraft: (recipient) => get().drafts[recipient] || "",
  clearDraft: (recipient) =>
    set((state) => {
      const cleanDrafts = { ...state.drafts };
      delete cleanDrafts[recipient];
      return { drafts: cleanDrafts };
    }),
  reset: () =>
    set({
      drafts: {},
      attachment: null,
      priority: { amount: 0n, source: FeeSource.SenderPays },
      sendState: { status: "idle" },
    }),
}));

// selector helper
export const useComposerSlice = <T>(selector: (state: ComposerState) => T) =>
  useComposerStore(selector);
