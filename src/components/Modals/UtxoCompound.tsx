import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { clsx } from "clsx";
import { Address } from "kaspa-wasm";
import { FC, useCallback, useEffect, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { Button } from "../Common/Button";

// Type definitions
type CompoundResult = {
  txId: string;
  utxoCount: number;
};

type FrozenBalance = {
  matureUtxoCount: number;
  matureDisplay: string;
};

// Constants
const HIGH_UTXO_THRESHOLD = 100; // Threshold for showing high UTXO warning

export const UtxoCompound: FC = () => {
  const [isCompounding, setIsCompounding] = useState(false);
  const [compoundResult, setCompoundResult] = useState<CompoundResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<CompoundResult | null>(
    null
  );
  const [frozenBalance, setFrozenBalance] = useState<FrozenBalance | null>(
    null
  );

  const walletStore = useWalletStore();
  const { accountService, unlockedWallet, balance, address, selectedNetwork } =
    walletStore;

  // Monitor balance changes to detect when compound is complete
  useEffect(() => {
    if (pendingResult && balance?.matureUtxoCount === 1 && !isCompounding) {
      // Compound is complete: we have exactly 1 UTXO and not processing anymore
      setCompoundResult(pendingResult);
      setPendingResult(null);
      setFrozenBalance(null); // Clear frozen balance to show final result
    }
  }, [balance?.matureUtxoCount, isCompounding, pendingResult]);

  // Helper functions
  const getExplorerUrl = useCallback(
    (txId: string) => {
      return selectedNetwork === "mainnet"
        ? `https://explorer.kaspa.org/txs/${txId}`
        : `https://explorer-tn10.kaspa.org/txs/${txId}`;
    },
    [selectedNetwork]
  );

  const resetAllStates = useCallback(() => {
    setError(null);
    setCompoundResult(null);
    setFrozenBalance(null);
    setPendingResult(null);
  }, []);

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

  const handleCompoundUtxos = useCallback(async () => {
    if (!accountService || !unlockedWallet || !address) {
      setError("Wallet not properly initialized");
      return;
    }

    if (!balance?.matureUtxoCount || balance.matureUtxoCount < 2) {
      return; // Silently do nothing if not enough UTXOs
    }

    setIsCompounding(true);
    resetAllStates();

    // Freeze the balance display during processing
    setFrozenBalance({
      matureUtxoCount: balance.matureUtxoCount,
      matureDisplay: balance.matureDisplay,
    });

    try {
      const txId = await accountService.createWithdrawTransaction(
        {
          address: new Address(address.toString()), // Send to self
          amount: balance.mature, // Send entire balance
        },
        unlockedWallet.password
      );

      console.log(`UTXO Compounding succeed, txid: ${txId}`);
      setFrozenBalance(null); // Clear frozen balance on complete
    } catch (err) {
      console.error("UTXO compounding failed:", err);
      setError(getUserFriendlyErrorMessage(err));
      setFrozenBalance(null); // Clear frozen balance on error
    } finally {
      setIsCompounding(false);
    }
  }, [
    accountService,
    unlockedWallet,
    balance,
    address,
    resetAllStates,
    getUserFriendlyErrorMessage,
  ]);

  if (!balance) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-400">Loading wallet information...</p>
      </div>
    );
  }

  // Use frozen balance during processing, otherwise use current balance
  const displayBalance = frozenBalance || balance;

  const shouldShowCompound = Boolean(
    balance?.matureUtxoCount && balance.matureUtxoCount >= 2
  );
  const isHighUtxoCount = Boolean(
    displayBalance?.matureUtxoCount &&
      displayBalance.matureUtxoCount > HIGH_UTXO_THRESHOLD
  );

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">
          Compound UTXOs
        </h3>
        <p className="text-sm text-gray-300 mb-4">
          Combine multiple UTXOs into fewer, larger ones to optimize wallet
          performance
        </p>
      </div>

      {/* UTXO Information */}
      <div className="bg-[var(--primary-bg)] rounded-lg p-4 border border-[var(--border-color)]">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Mature UTXOs:</span>
            <div
              className={clsx("font-semibold", {
                "text-orange-400": isHighUtxoCount,
                "text-white": !isHighUtxoCount,
              })}
            >
              {displayBalance?.matureUtxoCount ?? "-"}
              {isHighUtxoCount && (
                <span className="text-xs text-orange-400 ml-1">(High)</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Total Balance:</span>
            <div className="font-semibold text-white">
              {displayBalance?.matureDisplay} KAS
            </div>
          </div>
        </div>
      </div>

      {/* Performance Warning */}
      {isHighUtxoCount && (
        <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-orange-400 font-medium">
                High UTXO Count Detected
              </p>
              <p className="text-gray-300 mt-1">
                Having many UTXOs can slow down transactions and increase memory
                usage. Compounding is recommended for optimal performance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="bg-[var(--primary-bg)] rounded-lg p-3 border border-[var(--border-color)]">
        <div className="flex items-center justify-center gap-2 w-full">
          <p className="font-medium text-white text-sm">How it works:</p>
        </div>
        <ul className="space-y-1 text-xs text-gray-300">
          <li>• Combines multiple small UTXOs into fewer larger ones</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Show compound button only if we have enough UTXOs and not processing/completed */}
        {shouldShowCompound &&
          !isCompounding &&
          !compoundResult &&
          !pendingResult && (
            <Button
              onClick={handleCompoundUtxos}
              variant="primary"
            >
              Compound {balance?.matureUtxoCount ?? 0} UTXOs
            </Button>
          )}

        {/* Processing State */}
        {(isCompounding || pendingResult) && !compoundResult && (
          <div className="bg-[var(--primary-bg)] rounded-lg p-4 border border-[var(--border-color)] text-center">
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span className="text-white font-medium">
                Processing compound transaction
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <XCircleIcon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-gray-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {compoundResult && (
        <div className="bg-green-600 bg-opacity-20 border border-green-500 border-opacity-50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="text-sm text-white">
              <p className="font-semibold">Success</p>
              <p className="mt-1">
                Compound transaction successful! Your {compoundResult.utxoCount}{" "}
                UTXOs have been consolidated into 1 larger UTXO. The transaction
                is now confirming on the network.
              </p>
              <p className="text-gray-200 mt-2">
                <span className="text-gray-300">Transaction ID:</span>{" "}
                <a
                  href={getExplorerUrl(compoundResult.txId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 underline break-all"
                >
                  {compoundResult.txId.substring(0, 8)}...
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
