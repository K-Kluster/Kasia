import { useEffect, useState } from "react";
import {
  Attachment,
  useComposerStore,
} from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { Address } from "kaspa-wasm";
import { FeeState } from "../../types/all";

export const useFeeEstimate = ({
  toSelf = false,
  recipient,
  draft,
  attachment,
  broadcastOptions,
  groupOptions,
}: {
  toSelf?: boolean;
  recipient?: string;
  draft?: string;
  attachment?: Attachment;
  broadcastOptions?: {
    isBroadcast: boolean;
    channelName: string;
  };
  groupOptions?: {
    isGroup: boolean;
    groupId: string;
    groupRootEpoch: string;
    blindingKey: string;
    epoch: number;
    deviceId: string;
    msgCounter: number;
  };
}) => {
  const [feeState, setFeeState] = useState<FeeState>({ status: "idle" });

  const {
    priority,
    sendState: { status: sendStatus },
  } = useComposerStore();
  const {
    unlockedWallet,
    estimateSendMessageFees,
    estimateSendBroadcastFees,
    estimateSendGroupMessageFees,
    address,
    balance,
  } = useWalletStore();

  const matureBalance = balance?.mature;
  const addressString = address?.toString();
  const isBroadcast = broadcastOptions?.isBroadcast ?? false;
  const broadcastChannelName = broadcastOptions?.channelName ?? "";
  const isGroup = groupOptions?.isGroup ?? false;

  useEffect(() => {
    const targetAddress = toSelf ? addressString : recipient;
    const hasContent = draft || attachment;
    const shouldSkip =
      (!targetAddress && !isGroup) ||
      !hasContent ||
      !unlockedWallet ||
      sendStatus === "loading";

    if (shouldSkip) {
      setFeeState({ status: "idle" });
      return;
    }

    if (isBroadcast && !broadcastChannelName) {
      setFeeState({ status: "idle" });
      return;
    }

    if (isGroup && !groupOptions) {
      setFeeState({ status: "idle" });
      return;
    }

    if (!matureBalance || matureBalance === 0n) {
      setFeeState({
        status: "error",
        error: new Error("No funds available for fee estimation"),
      });
      return;
    }

    let parsedAddress: Address | undefined;
    if (!isGroup) {
      const addressToUse = isBroadcast ? addressString : targetAddress;

      if (!addressToUse) {
        setFeeState({
          status: "error",
          error: new Error("Address is required"),
        });
        return;
      }
      try {
        parsedAddress = new Address(addressToUse);
      } catch {
        setFeeState({
          status: "error",
          error: new Error("Invalid address"),
        });
        return;
      }
    }

    setFeeState({ status: "loading" });
    let isCancelled = false;

    const messageContent = attachment ? attachment.content : draft || "";

    const estimatePromise = isGroup
      ? estimateSendGroupMessageFees(
          groupOptions!.groupId,
          groupOptions!.groupRootEpoch,
          groupOptions!.blindingKey,
          groupOptions!.epoch,
          groupOptions!.deviceId,
          groupOptions!.msgCounter,
          messageContent,
          attachment ?? undefined,
          priority
        )
      : isBroadcast
        ? estimateSendBroadcastFees(
            messageContent,
            parsedAddress!,
            broadcastChannelName,
            priority
          )
        : estimateSendMessageFees(messageContent, parsedAddress!, priority);

    estimatePromise
      .then((estimate) => {
        if (!isCancelled) {
          const fee = Number(estimate.fees) / 100_000_000;
          setFeeState({ status: "idle", value: fee });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setFeeState({ status: "error", error: error as Error });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    draft,
    attachment,
    toSelf,
    addressString,
    recipient,
    isGroup,
    unlockedWallet,
    sendStatus,
    isBroadcast,
    broadcastChannelName,
    groupOptions,
    matureBalance,
    estimateSendGroupMessageFees,
    estimateSendBroadcastFees,
    estimateSendMessageFees,
    priority,
  ]);

  return feeState;
};
