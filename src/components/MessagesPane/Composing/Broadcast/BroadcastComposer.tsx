import React, { useRef } from "react";
import { SendHorizonal } from "lucide-react";
import clsx from "clsx";
import {
  useComposerStore,
  useComposerSlice,
  ComposerState,
} from "../../../../store/message-composer.store";
import { useBroadcastComposer } from "../../../../hooks/MessageComposer/useBroadcastComposer";
import { MessageInput } from "../Utilities/MessageInput";
import { FeeDisplay } from "../Utilities/FeeDisplay";
import { useFeeEstimate } from "../../../../hooks/MessageComposer/useFeeEstimate";
import { useIsMobile } from "../../../../hooks/useIsMobile";
import {
  useFeatureFlagsStore,
  FeatureFlags,
} from "../../../../store/featureflag.store";
import { MARKDOWN_PREFIX } from "../../../../config/constants";

export const BroadcastComposer = ({ channelName }: { channelName: string }) => {
  const setDraft = useComposerStore((s: ComposerState) => s.setDraft);
  const draft = useComposerStore(
    (s: ComposerState) => s.drafts[channelName] || ""
  );
  const priority = useComposerStore((s: ComposerState) => s.priority);
  const setPriority = useComposerStore((s: ComposerState) => s.setPriority);
  const sendState = useComposerSlice((s: ComposerState) => s.sendState);
  const setSendState = useComposerStore((s: ComposerState) => s.setSendState);

  const { sendBroadcast } = useBroadcastComposer(channelName);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isMobile = useIsMobile();

  const { flags } = useFeatureFlagsStore();
  const markdownEnabled = flags[FeatureFlags.MARKDOWN];

  // readines check
  const canBroadcast = !!channelName && !!sendBroadcast;

  // auto-focus on mobile when channel is selected
  React.useEffect(() => {
    if (isMobile && canBroadcast && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [isMobile, canBroadcast]);

  const feeState = useFeeEstimate({
    toSelf: true,
    recipient: undefined,
    draft,
    attachment: undefined,
    broadcastOptions: {
      isBroadcast: true,
      channelName,
    },
  });

  const handleDraftChange = (value: string) => {
    setDraft(channelName, value);
    if (sendState.status === "error") {
      setSendState({ status: "idle" });
    }
  };

  const onSend = async () => {
    await sendBroadcast();
  };

  return (
    <div className="border-primary-border bg-secondary-bg relative flex-col gap-8 border-t">
      <FeeDisplay
        draft={draft}
        attachment={undefined}
        feeState={feeState}
        priority={priority}
        onPriorityChange={setPriority}
      />
      <div className="relative mx-2 my-2 rounded-lg p-1 pb-3 sm:pb-0">
        <div className="relative flex items-center">
          <MessageInput
            ref={messageInputRef}
            value={
              canBroadcast
                ? markdownEnabled && draft.startsWith(MARKDOWN_PREFIX)
                  ? draft.slice(MARKDOWN_PREFIX.length)
                  : draft
                : ""
            }
            onChange={handleDraftChange}
            onSend={onSend}
            onDragOver={false}
            onPaste={() => {}}
            placeholder={
              canBroadcast
                ? "Type your broadcast..."
                : "Wallet not ready for broadcasting..."
            }
            disabled={sendState.status === "loading" || !canBroadcast}
          />

          <div className="absolute right-2 flex h-full items-center gap-1">
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={onSend}
                  className={clsx(
                    "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80 active:scale-90 active:opacity-80",
                    draft.trim()
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-4 opacity-0"
                  )}
                  aria-label="Send Broadcast"
                >
                  <SendHorizonal className="size-6" />
                  <span className="absolute h-full w-full p-5 pointer-fine:hidden" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
