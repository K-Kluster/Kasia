import { useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { toast } from "../utils/toast-helper";
import { kaspaToSompi } from "kaspa-wasm";

interface UseSelfStashProps {
  partnerAddress: string;
  ourAlias: string;
  theirAlias: string;
  onCompleted?: () => void;
}

interface UseSelfStashReturn {
  isCreating: boolean;
  isCompleted: boolean;
  hasSufficientFunds: boolean;
  handleCreateSelfStash: () => Promise<void>;
}

export const useSelfStash = ({
  partnerAddress,
  ourAlias,
  theirAlias,
  onCompleted,
}: UseSelfStashProps): UseSelfStashReturn => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const { createSelfStash, setOpenedRecipient } = useMessagingStore();
  const balanceMature = useWalletStore((s) => s.balance?.mature);

  // check if user has sufficient funds for self stash (0.2 KAS minimum)
  const maxDustAmount = kaspaToSompi("0.2")!;
  const hasSufficientFunds = balanceMature
    ? balanceMature >= BigInt(maxDustAmount)
    : false;

  const handleCreateSelfStash = async () => {
    if (!partnerAddress || !ourAlias || !theirAlias) {
      toast.error("Missing required handshake data");
      return;
    }

    setIsCreating(true);
    try {
      // create single self-stash for off-chain handshake (contains both aliases)
      await createSelfStash({
        type: "initiation",
        partnerAddress,
        ourAlias,
        theirAlias,
      });

      setIsCompleted(true);

      // select the newly created conversation
      setOpenedRecipient(partnerAddress);

      toast.success("Handshake Saved");

      // call the completion callback if provided
      if (onCompleted) {
        setTimeout(onCompleted, 1500);
      }
    } catch (error) {
      console.error("Failed to create self stash:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save off-chain handshake"
      );
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    isCompleted,
    hasSufficientFunds,
    handleCreateSelfStash,
  };
};
