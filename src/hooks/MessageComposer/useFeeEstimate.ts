import { useEffect } from "react";
import {
  Attachment,
  useComposerStore,
} from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { Address } from "kaspa-wasm";

export const useFeeEstimate = (
  recipient?: string,
  draft?: string,
  attachment?: Attachment
) => {
  const {
    priority,
    sendState: { status: sendStatus },
    setFeeState,
  } = useComposerStore();
  const { unlockedWallet, estimateSendMessageFees } = useWalletStore();

  useEffect(() => {
    if (
      !recipient ||
      (!draft && !attachment) ||
      !unlockedWallet ||
      sendStatus === "loading"
    ) {
      setFeeState({ status: "idle" });
      return;
    }

    let address: Address;
    try {
      address = new Address(recipient);
    } catch {
      setFeeState({
        status: "error",
        error: new Error("Invalid recipient address"),
      });
      return;
    }

    setFeeState({ status: "loading" });
    let isCancelled = false;

    // debounce the fee estimation
    const timeoutId = setTimeout(() => {
      // use attachment content if available, otherwise use draft text
      const messageContent = attachment ? attachment.content : draft || "";

      estimateSendMessageFees(messageContent, address, priority)
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
    }, 400);

    return () => {
      // prevent promise from updating state after cleanup
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    recipient,
    draft,
    attachment,
    priority,
    sendStatus,
    unlockedWallet,
    setFeeState,
    estimateSendMessageFees,
  ]);
};
