import { useRef, useState, DragEvent, useEffect, useMemo } from "react";
import {
  useComposerSlice,
  useComposerStore,
} from "../../../../store/message-composer.store";
import { useMessageComposer } from "../../../../hooks/MessageComposer/useMessageComposer";
import { SendHorizonal, Paperclip, Camera, Plus } from "lucide-react";
import clsx from "clsx";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { SendPaymentPopup } from "../../../SendPaymentPopup";
import { MessageInput } from "../Utilities/MessageInput";
import { FeeDisplay } from "../Utilities/FeeDisplay";
import { useMessagingStore } from "../../../../store/messaging.store";
import { useGroupStore } from "../../../../store/group.store";
import { useFeeEstimate } from "../../../../hooks/MessageComposer/useFeeEstimate";
import { toast } from "../../../../utils/toast-helper";
import { MAX_CHAT_INPUT_CHAR } from "../../../../config/constants";
import { cameraPermissionService } from "../../../../service/camera-permission-service";
import { useIsMobile } from "../../../../hooks/useIsMobile";
import {
  useFeatureFlagsStore,
  FeatureFlags,
} from "../../../../store/featureflag.store";

interface DirectComposerProps {
  recipient?: string;
  groupId?: string;
}

export const DirectComposer = ({ recipient, groupId }: DirectComposerProps) => {
  const isGroupMode = !!groupId;
  const draftKey = groupId || recipient;

  const attachment = useComposerSlice((s) => s.attachment);
  const sendState = useComposerSlice((s) => s.sendState);
  const priority = useComposerSlice((s) => s.priority);
  const setDraft = useComposerStore((s) => s.setDraft);
  const setAttachment = useComposerStore((s) => s.setAttachment);

  const draft = useComposerSlice((s) =>
    draftKey ? s.drafts[draftKey] || "" : ""
  );

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();
  const [isGroupSending, setIsGroupSending] = useState(false);

  const groupStore = useGroupStore();
  const selectedGroup = useMemo(
    () => (isGroupMode ? groupStore.getGroupWithMessages(groupId) : null),
    [isGroupMode, groupId, groupStore]
  );

  const groupRootEpoch = selectedGroup?.group.groupRootEpoch;
  const blindingKey = selectedGroup?.group.blindingKey;
  const currentEpoch = selectedGroup?.group.currentEpoch;
  const deviceId = selectedGroup?.group.deviceId;
  const nextMsgCounter = selectedGroup?.group.msgCounter ?? 0;

  const groupOptions = useMemo(() => {
    if (
      !isGroupMode ||
      !selectedGroup ||
      !groupRootEpoch ||
      !blindingKey ||
      currentEpoch === undefined ||
      !deviceId
    )
      return undefined;
    return {
      isGroup: true,
      groupId,
      groupRootEpoch,
      blindingKey,
      epoch: currentEpoch,
      deviceId,
      msgCounter: nextMsgCounter,
    };
  }, [
    isGroupMode,
    selectedGroup,
    groupId,
    groupRootEpoch,
    blindingKey,
    currentEpoch,
    deviceId,
    nextMsgCounter,
  ]);

  const feeState = useFeeEstimate({
    toSelf: !isGroupMode, // Only use toSelf for non-group messages
    recipient: isGroupMode ? undefined : recipient,
    draft,
    attachment,
    groupOptions,
  });

  const { send, attach } = useMessageComposer(
    feeState,
    isGroupMode ? undefined : recipient,
    isGroupMode
  );
  const setPriority = useComposerStore((s) => s.setPriority);
  const setSendState = useComposerStore((s) => s.setSendState);

  const oooc = useMessagingStore((s) =>
    recipient && !isGroupMode
      ? s.oneOnOneConversations.find(
          ({ contact }) => contact.kaspaAddress === recipient
        )
      : undefined
  );
  const conversation = oooc?.conversation;

  // for groups, always allow composing; for directs, check conversation status
  const canCompose = isGroupMode
    ? true
    : !!conversation &&
      (conversation.status === "active" ||
        (conversation.status === "pending" && conversation.initiatedByMe));

  // Check if camera feature is enabled
  const { flags } = useFeatureFlagsStore();
  const cameraEnabled = flags[FeatureFlags.ENABLED_CAMERA];

  const guardReady = () => {
    if (isGroupMode) return true;
    if (!canCompose) {
      toast.error("Accept or send handshake to chat");
      return false;
    }
    return true;
  };

  const [isDragOver, setIsDragOver] = useState(false);

  // check message length and trim if over limit
  useEffect(() => {
    if (draft.length > MAX_CHAT_INPUT_CHAR) {
      toast.removeAll();
      toast.error(
        `Over max message length of ${MAX_CHAT_INPUT_CHAR}, message trimmed.`
      );
      const trimmedDraft = draft.slice(0, MAX_CHAT_INPUT_CHAR);
      if (draftKey) setDraft(draftKey, trimmedDraft);
    }
  }, [draft, draftKey, setDraft]);

  const openFileDialog = () => {
    if (!guardReady()) return;
    fileInputRef.current?.click();
  };
  const openCameraDialog = async () => {
    if (!guardReady()) return;

    // Check camera access through the service
    const hasAccess = await cameraPermissionService.requestCamera();
    if (hasAccess) {
      cameraInputRef.current?.click();
    }
  };

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
    if (!guardReady()) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) await attach(file, "Pasted Image");
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
    if (!guardReady()) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await attach(files[0], "Dropped File");
  };

  const handleDraftChange = (value: string) => {
    if (!guardReady()) return;
    if (draftKey) setDraft(draftKey, value);
    if (sendState.status === "error") setSendState({ status: "idle" });
  };

  const onSend = async () => {
    if (!guardReady()) return;

    // group mode - send to group
    if (isGroupMode && groupId) {
      if (!draft.trim() && !attachment) {
        toast.error("Please enter a message or attach a file.");
        return;
      }
      setIsGroupSending(true);
      try {
        await groupStore.sendGroupMessage(
          groupId,
          draft.trim(),
          attachment || undefined
        );
        setDraft(groupId, "");
        setAttachment(null);
      } catch (error) {
        console.error("Failed to send group message:", error);
        toast.error("Failed to send message");
      } finally {
        setIsGroupSending(false);
      }
      return;
    }

    // direct mode - send to conversation
    if (!conversation || !canCompose) return;

    // guard: theirAlias must exist to send messages
    if (!conversation.theirAlias) {
      toast.error("Cannot send: recipient alias not yet established");
      return;
    }

    // send to theirAlias (recipient monitors this), not myAlias
    console.log("[DirectComposer] Sending message:", {
      myAlias: conversation.myAlias,
      theirAlias: conversation.theirAlias,
      sendingTo: conversation.theirAlias,
      note: "Sending to theirAlias - recipient should be monitoring this",
    });
    await send(conversation.theirAlias);
  };

  return (
    <div
      className={clsx(
        "border-primary-border bg-secondary-bg relative flex-col gap-8 border-t",
        isDragOver && "border-kas-primary bg-kas-primary/10"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <FeeDisplay
        draft={draft}
        attachment={attachment}
        feeState={feeState}
        priority={priority}
        onPriorityChange={setPriority}
      />
      <div className="relative my-2 mr-2 rounded-lg p-1 pb-3 sm:pb-0">
        <div className="relative flex items-center">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <Popover className="relative">
              {({ close }) => (
                <>
                  <PopoverButton className="rounded p-1 hover:bg-white/5 active:scale-90 active:opacity-80">
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
                    <PopoverPanel className="bg-secondary-bg absolute bottom-full left-0 z-30 mb-2 flex flex-col gap-2 rounded p-2 shadow-lg">
                      <button
                        onClick={() => {
                          openFileDialog();
                          close();
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-white/5 active:scale-90 active:opacity-80 disabled:opacity-20"
                      >
                        <Paperclip className="m-2 size-5" />
                      </button>
                      {recipient && !isGroupMode && (
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
            value={canCompose ? draft : ""}
            onChange={handleDraftChange}
            onDragOver={isDragOver}
            onSend={onSend}
            onPaste={handlePaste}
            placeholder={
              isGroupMode
                ? "Type a message to the group..."
                : canCompose
                  ? "Type your message..."
                  : isMobile
                    ? "Handshake required..."
                    : "Accept or send handshake to chat..."
            }
            disabled={
              sendState.status === "loading" || isGroupSending || !canCompose
            }
          />

          <div className="absolute right-2 flex h-full items-center gap-1">
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={onSend}
                  className={clsx(
                    "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80 active:scale-90 active:opacity-80",
                    draft.trim() || attachment
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-4 opacity-0"
                  )}
                  aria-label="Send"
                >
                  <SendHorizonal className="size-6" />
                  <span className="absolute h-full w-full p-5 pointer-fine:hidden" />
                </button>
                {cameraEnabled && (
                  <button
                    onClick={openCameraDialog}
                    className={clsx(
                      "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80 active:scale-90 active:opacity-80",
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.txt,.json,.md"
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
