import { RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { FC, useCallback, useEffect, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast-helper";
import {
  HIGH_UTXO_THRESHOLD,
  UTXO_MIN_COMPOUND_COUNT,
} from "../../config/constants";

type FrozenBalance = {
  matureUtxoCount: number;
  matureDisplay: string;
};

type UtxoCompoundProps = {
  onFrozenBalanceChange?: (frozenBalance: FrozenBalance | null) => void;
};

export const UtxoCompound: FC<UtxoCompoundProps> = ({
  onFrozenBalanceChange,
}) => {
  const [isCompounding, setIsCompounding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozenBalance, setFrozenBalance] = useState<FrozenBalance | null>(
    null
  );

  const walletStore = useWalletStore();
  const { accountService, unlockedWallet, balance, address } = walletStore;

  const compoundNotNeeded =
    !balance?.matureUtxoCount ||
    (balance?.matureUtxoCount &&
      balance?.matureUtxoCount < UTXO_MIN_COMPOUND_COUNT);

  // notify parent whenever frozen balance changes
  useEffect(() => {
    onFrozenBalanceChange?.(frozenBalance);
  }, [frozenBalance, onFrozenBalanceChange]);

  // Monitor balance changes to detect when compound is complete
  useEffect(() => {
    if (balance?.matureUtxoCount === 1 && !isCompounding) {
      // Compound is complete: we have exactly 1 UTXO and not processing anymore
      setFrozenBalance(null); // Clear frozen balance to show final result
    }
  }, [balance?.matureUtxoCount, isCompounding]);

  const getUserFriendlyErrorMessage = useCallback((err: unknown): string => {
    if (!(err instanceof Error)) return "Transaction failed. Please try again.";

    if (err.message.includes("insufficient")) {
      return "Insufficient balance to cover transaction fees.";
    }
    if (err.message.includes("No balance available")) {
      return "Balance unavailable during batch processing. Please try again.";
    }
    if (err.message.includes("Wallet not properly initialized")) {
      return "Wallet connection lost. Please refresh and try again.";
    }
    return "Transaction failed. Please check your connection and try again.";
  }, []);

  const handleCompoundUtxos = async () => {
    if (
      !accountService ||
      !unlockedWallet ||
      !address ||
      !balance?.matureUtxoCount ||
      compoundNotNeeded
    ) {
      return;
    }

    setIsCompounding(true);
    setError(null);
    setFrozenBalance(null);

    // Freeze the balance display during processing
    setFrozenBalance({
      matureUtxoCount: balance.matureUtxoCount,
      matureDisplay: balance.matureDisplay,
    });

    try {
      const txId = await accountService.createCompoundTransaction();
      console.log(`UTXO Compounding succeed, txid: ${txId}`);
    } catch (err) {
      console.error("UTXO compounding failed:", err);
      setError(getUserFriendlyErrorMessage(err));
      setFrozenBalance(null); // Clear frozen balance on error
    } finally {
      setIsCompounding(false);
      toast.success("Success: Funds Compounded");
    }
  };

  const isHighUtxoCount = Boolean(
    balance?.matureUtxoCount && balance.matureUtxoCount > HIGH_UTXO_THRESHOLD
  );

  if (compoundNotNeeded) return;

  return (
    <div className="mt-4">
      <div className="mb-2">
        <h3 className="mb-1 text-center text-base font-semibold sm:text-left">
          Compound UTXOs
        </h3>
        <p className="text-center text-sm text-[var(--text-secondary)] sm:text-left">
          Combine multiple UTXOs into fewer, larger ones to optimize account
          performance. This creates a tx and sends all funds automatically to
          yourself. Network fees will apply.
        </p>
      </div>

      {/* Performance Warning */}
      {isHighUtxoCount && (
        <div className="my-2 rounded-lg border border-[var(--accent-yellow)] bg-[var(--secondary-bg)] p-1 sm:my-3">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <AlertTriangle className="m-0 size-6 text-[var(--accent-yellow)] sm:m-1" />
            <div className="text-center text-xs sm:text-left">
              <p className="font-medium text-[var(--accent-yellow)]">
                High UTXO Count Detected
              </p>
              <p className="mt-1 text-[var(--accent-yellow)]">
                Having many UTXOs can slow down transactions and increase memory
                usage. Compounding is recommended for optimal performance
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="my-1 space-y-1">
        {/* Show compound button only if we have enough UTXOs and not processing/completed */}
        {!compoundNotNeeded && !isCompounding && (
          <Button
            onClick={handleCompoundUtxos}
            variant="primary"
            className="!p-1.5"
          >
            Compound {balance?.matureUtxoCount} UTXOs
          </Button>
        )}

        {/* Processing State */}
        {isCompounding && (
          <div className="border-primary-border bg-primary-bg rounded-lg border p-2">
            <div className="text-kas-primary flex items-center gap-1">
              <RefreshCw className="mx-2 size-6 animate-spin" />
              <span className="font-medium">
                Processing compound transaction
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="bg-opacity-10 border-opacity-30 rounded-lg border border-[var(--accent-red)] bg-[var(--accent-red)] p-3">
          <div className="flex items-start gap-2 text-white">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="text-base">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
