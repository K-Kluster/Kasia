import { FC, useState, useCallback } from "react";
import { useWalletStore } from "../store/wallet.store";
import { formatKasAmount } from "../utils/format";
import { Address, kaspaToSompi } from "kaspa-wasm";
import { clsx } from "clsx";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";

export const UtxoCompound: FC = () => {
  const [isCompounding, setIsCompounding] = useState(false);
  const [compoundResult, setCompoundResult] = useState<{
    txId: string;
    utxoCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walletStore = useWalletStore();
  const { accountService, unlockedWallet, balance, address, selectedNetwork } =
    walletStore;

  // Get the correct explorer URL based on network
  const getExplorerUrl = (txId: string) => {
    return selectedNetwork === "mainnet"
      ? `https://explorer.kaspa.org/txs/${txId}`
      : `https://explorer-tn10.kaspa.org/txs/${txId}`;
  };

  const handleCompoundUtxos = useCallback(async () => {
    if (!accountService || !unlockedWallet || !address) {
      setError("Wallet not properly initialized");
      return;
    }

    if (!balance?.matureUtxoCount || balance.matureUtxoCount < 2) {
      setError("Need at least 2 UTXOs to compound");
      return;
    }

    setIsCompounding(true);
    setError(null);
    setCompoundResult(null);

    try {
      // Get current UTXOs and balance
      const matureUtxos = accountService.getMatureUtxos();
      const utxoCount = matureUtxos.length;
      const totalBalance = balance.mature;

      console.log(`Starting UTXO compounding for ${utxoCount} UTXOs`);
      console.log(`Total balance: ${balance.matureDisplay} KAS`);

      // Use the withdrawal transaction method with "send all" approach
      // This avoids KIP-9 dust issues by letting the generator handle fees properly
      const txId = await accountService.createWithdrawTransaction(
        {
          address: new Address(address.toString()), // Send to self
          amount: totalBalance, // Send entire balance (generator will handle fees)
        },
        unlockedWallet.password
      );

      console.log(`Compound transaction created: ${txId}`);

      setCompoundResult({
        txId,
        utxoCount,
      });
    } catch (err) {
      console.error("UTXO compounding failed:", err);

      // Provide more helpful error messages
      let errorMessage = "Failed to compound UTXOs";
      if (err instanceof Error) {
        if (err.message.includes("Storage mass exceeds maximum")) {
          errorMessage =
            "Too many UTXOs to compound in one transaction. Try withdrawing some funds first to reduce UTXO count.";
        } else if (err.message.includes("insufficient")) {
          errorMessage = "Insufficient balance to cover transaction fees.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsCompounding(false);
    }
  }, [accountService, unlockedWallet, balance, address]);

  if (!balance) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-400">Loading wallet information...</p>
      </div>
    );
  }

  const shouldShowCompound =
    balance.matureUtxoCount && balance.matureUtxoCount >= 2;
  const isHighUtxoCount =
    balance.matureUtxoCount && balance.matureUtxoCount > 100;

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
              {balance.matureUtxoCount || 0}
              {isHighUtxoCount && (
                <span className="text-xs text-orange-400 ml-1">(High)</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Total Balance:</span>
            <div className="font-semibold text-white">
              {balance.matureDisplay} KAS
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
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">How it works:</p>
            <ul className="space-y-1 text-xs">
              <li>• Combines multiple small UTXOs into fewer larger ones</li>
              <li>• Reduces memory usage and improves transaction speed</li>
              <li>
                • Uses batch transactions to handle mass limits efficiently
              </li>
              <li>• Recommended when you have 100+ UTXOs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!shouldShowCompound ? (
          <div className="bg-[var(--primary-bg)] rounded-lg p-3 border border-[var(--border-color)] text-center">
            <p className="text-gray-300 text-sm">
              Need at least 2 UTXOs to compound
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Current UTXOs: {balance.matureUtxoCount || 0}
            </p>
          </div>
        ) : (
          <button
            onClick={handleCompoundUtxos}
            disabled={isCompounding}
            className={clsx(
              "w-full px-4 py-3 rounded-lg font-medium transition-all duration-200",
              {
                "bg-gray-600 text-gray-400 cursor-not-allowed": isCompounding,
                "bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500":
                  !isCompounding,
              }
            )}
          >
            {isCompounding ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                Compounding UTXOs...
              </div>
            ) : (
              `Compound ${balance.matureUtxoCount} UTXOs`
            )}
          </button>
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
            <CheckCircleIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-green-300 font-medium">Success</p>
              <p className="text-white mt-1">
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
