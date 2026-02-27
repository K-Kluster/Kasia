import { useComposerStore } from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { useBroadcastStore } from "../../store/broadcast.store";
import {
  useFeatureFlagsStore,
  FeatureFlags,
} from "../../store/featureflag.store";
import { MARKDOWN_PREFIX } from "../../config/constants";
import { toast } from "../../utils/toast-helper";

export const useBroadcastComposer = (channelName?: string) => {
  const { sendState, setSendState, clearDraft } = useComposerStore();
  const { addMessage, updateMessageStatus } = useBroadcastStore();
  const { flags } = useFeatureFlagsStore();
  const markdownEnabled = flags[FeatureFlags.MARKDOWN];

  const draft = useComposerStore((s) =>
    channelName ? s.drafts[channelName] || "" : ""
  );

  const walletStore = useWalletStore();

  const sendBroadcast = async () => {
    toast.removeAll();
    if (!channelName) {
      toast.error("Channel name is required");
      return;
    }

    if (!draft.trim()) {
      toast.error("Please enter a message to broadcast.");
      return;
    }

    if (sendState.status === "loading") {
      return;
    }

    let messageId: string | undefined;

    try {
      setSendState({ status: "loading" });

      const messageToSend = draft;

      const txId = await walletStore.sendBroadcastWithContext({
        message: messageToSend,
        channelName: channelName.toLowerCase(),
        priorityFee: useComposerStore.getState().priority,
      });

      console.log(`Broadcast message sent to channel ${channelName}:`, txId);

      addMessage({
        id: txId,
        channelName: channelName.toLowerCase(),
        senderAddress: walletStore.address!.toString(),
        content: messageToSend,
        timestamp: new Date(),
        transactionId: txId,
        status: "pending",
      });

      messageId = txId;

      // clear
      clearDraft(channelName);
      setSendState({ status: "idle" });
    } catch (error) {
      console.error("Error sending broadcast message:", error);

      // Mark message as failed if we have a message ID
      if (messageId) {
        updateMessageStatus(messageId, "failed");
      }
      setSendState({ status: "error", error: error as Error });

      // Reset error state after a delay
      setTimeout(() => setSendState({ status: "idle" }), 3000);
    }
  };

  return { sendBroadcast, draft };
};
