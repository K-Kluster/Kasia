import { useRef, useState, DragEvent, useEffect } from "react";
import {
  useComposerSlice,
  useComposerStore,
} from "../../store/message-composer.store";
import { useMessageComposer } from "../../hooks/MessageComposer/useMessageComposer";
import { SendHorizonal, Paperclip, Camera, Plus } from "lucide-react";
import clsx from "clsx";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { SendPaymentPopup } from "../SendPaymentPopup";
import { MessageInput } from "./MessageInput";
import { FeeDisplay } from "./FeeDisplay";

interface MessageComposerShellProps {
  recipient?: string;
  onExpand?: () => void;
}

export const MessageComposerShell = ({
  recipient,
}: MessageComposerShellProps) => {
  const draft = useComposerSlice((s) => s.draft);
  const attachment = useComposerSlice((s) => s.attachment);
  const feeState = useComposerSlice((s) => s.feeState);
  const sendState = useComposerSlice((s) => s.sendState);
  const priority = useComposerSlice((s) => s.priority);

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const { send, attach } = useMessageComposer(recipient);
  const setDraft = useComposerStore((s) => s.setDraft);
  const setPriority = useComposerStore((s) => s.setPriority);
  const setSendState = useComposerStore((s) => s.setSendState);

  const [isDragOver, setIsDragOver] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);

  // check if a camera exists
  useEffect(() => {
    async function checkCamera() {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasVideoInput = devices.some(
            (device) => device.kind === "videoinput"
          );
          setHasCamera(hasVideoInput);
        } catch {
          setHasCamera(false);
        }
      } else {
        setHasCamera(false);
      }
    }
    checkCamera();
  }, []);

  const openFileDialog = () => fileInputRef.current?.click();
  const openCameraDialog = () => cameraInputRef.current?.click();

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await attach(file, "File");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await attach(file, "Pasted Image");
        }
        break;
      }
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await attach(files[0], "Dropped File");
    }
  };

  // clear error state when user starts typing
  const handleDraftChange = (value: string) => {
    setDraft(value);
    // clear error state when user starts typing
    if (sendState.status === "error") {
      setSendState({ status: "idle" });
    }
  };

  return (
    <div
      className={clsx(
        "border-primary-border bg-secondary-bg relative flex-col gap-8 border-t transition-colors duration-200",
        isDragOver && "border-kas-primary bg-kas-primary/10"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* fee display - positioned in top-right like original */}
      <FeeDisplay
        recipient={recipient}
        draft={draft}
        feeState={feeState}
        priority={priority}
        onPriorityChange={setPriority}
      />

      {/* input area */}
      <div className="relative my-2 mr-2 rounded-lg p-1 pb-3 sm:pb-0">
        <div className="relative flex items-center">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <Popover className="relative">
              {({ close }) => (
                <>
                  <PopoverButton className="rounded p-1 hover:bg-white/5">
                    <Plus className="size-6 cursor-pointer text-[var(--button-primary)]" />
                  </PopoverButton>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                  >
                    <PopoverPanel className="bg-secondary-bg absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded p-2 shadow-lg">
                      <button
                        onClick={() => {
                          openFileDialog();
                          close();
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-white/5"
                      >
                        <Paperclip className="m-2 size-5" />
                      </button>
                      {recipient && (
                        <SendPaymentPopup
                          address={recipient}
                          onPaymentSent={close}
                        />
                      )}
                    </PopoverPanel>
                  </Transition>
                </>
              )}
            </Popover>
          </div>

          <MessageInput
            ref={messageInputRef}
            value={draft}
            onChange={handleDraftChange} // Use our new handler instead of setDraft directly
            onDragOver={isDragOver}
            onSend={send}
            onPaste={handlePaste}
            placeholder="Type your message..."
            disabled={sendState.status === "loading"}
          />

          {/* send button */}
          <div className="absolute right-2 flex h-full items-center gap-1">
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => {
                    send();
                  }}
                  className={clsx(
                    "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80",
                    draft.trim() || attachment
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-4 opacity-0"
                  )}
                  aria-label="Send"
                >
                  <SendHorizonal className="size-6" />
                </button>
                {hasCamera && (
                  <button
                    onClick={openCameraDialog}
                    className={clsx(
                      "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80",
                      !draft.trim() && !attachment
                        ? "pointer-events-auto translate-x-0 opacity-100"
                        : "pointer-events-none -translate-x-4 opacity-0"
                    )}
                    aria-label="Open Camera"
                  >
                    <Camera className="size-6" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};
