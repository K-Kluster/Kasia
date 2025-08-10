import { useEffect } from "react";
import { useComposerStore } from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { Address } from "kaspa-wasm";

export const useFeeEstimate = (recipient?: string) => {
  const { priority, sendState, setFeeState } = useComposerStore();
  const walletStore = useWalletStore();

  const draft = useComposerStore((s) =>
    recipient ? s.drafts[recipient] || "" : ""
  );

  useEffect(() => {
    if (
      !recipient ||
      !draft ||
      !walletStore.unlockedWallet ||
      sendState.status === "loading"
    ) {
      setFeeState({ status: "idle" });
      return;
    }

    setFeeState({ status: "loading" });
    let isCancelled = false;

    // debounce the fee estimation
    const timeoutId = setTimeout(() => {
      walletStore
        .estimateSendMessageFees(draft, new Address(recipient), priority)
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
    draft,
    recipient,
    priority,
    sendState.status,
    walletStore.unlockedWallet,
    setFeeState,
    walletStore,
  ]);
};
