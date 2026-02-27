import { useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { useUiStore } from "../../store/ui.store";
import { UtxoCompound } from "./UtxoCompound";
import { BALANCE_WARN } from "../../config/constants";
import { Button } from "../Common/Button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { HIGH_UTXO_THRESHOLD } from "../../config/constants";
import { useNetworkStore } from "../../store/network.store";

type FrozenBalance = { matureUtxoCount: number; matureDisplay: string };

export const Wallet = () => {
  const [frozenBalance, setFrozenBalance] = useState<FrozenBalance | null>(
    null
  );
  const [isUtxoExpanded, setIsUtxoExpanded] = useState(false);

  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const unlockedWalletName = useWalletStore((s) => s.unlockedWallet?.name);
  const walletBalance = useWalletStore((s) => s.balance);
  const network = useNetworkStore((s) => s.network);

  // use frozen balance if available, otherwise use current balance
  const currentBalance = frozenBalance
    ? {
        ...walletBalance,
        matureUtxoCount: frozenBalance.matureUtxoCount,
        matureDisplay: frozenBalance.matureDisplay,
      }
    : walletBalance;

  // auto-expand if mature utxo count is over threshold
  const shouldAutoExpand =
    (currentBalance?.matureUtxoCount ?? 0) > HIGH_UTXO_THRESHOLD;
  const isExpanded = isUtxoExpanded || shouldAutoExpand;

  const kasUnitDisplay = network === "mainnet" ? "KAS" : "TKAS";

  return (
    <div className="my-2 sm:mx-2">
      <section className="border-kas-secondary bg-kas-secondary/5 mb-4 rounded-2xl border p-4 sm:p-6">
        <div className="flex items-baseline justify-between">
          <div className="min-w-0">
            <h4 className="text-text-primary text-sm font-bold tracking-wide uppercase">
              Account
            </h4>
            <div className="truncate text-base font-semibold">
              {unlockedWalletName}
            </div>
          </div>
          <div className="text-right">
            <div className="text-text-primary text-xs font-bold uppercase opacity-80">
              Balance
            </div>
            <div className="text-lg leading-none font-extrabold text-[var(--accent-green)] sm:text-2xl">
              {currentBalance?.matureDisplay}{" "}
              <span className="opacity-80">{kasUnitDisplay}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="border-kas-secondary/40 bg-secondary-bg rounded-xl border px-3 py-2 text-left">
            <div className="text-text-primary text-xs font-semibold uppercase opacity-80">
              Pending
            </div>
            <div className="font-semibold text-[var(--accent-green)]">
              {currentBalance?.pendingDisplay}{" "}
              <span className="opacity-70">{kasUnitDisplay}</span>
            </div>
          </div>

          <div className="border-kas-secondary/40 bg-secondary-bg rounded-xl border px-3 py-2 text-left">
            <div className="text-text-primary text-xs font-semibold uppercase opacity-80">
              Outgoing
            </div>
            <div className="font-semibold text-[var(--accent-green)]">
              {currentBalance?.outgoingDisplay}{" "}
              <span className="opacity-70">{kasUnitDisplay}</span>
            </div>
          </div>

          <Button
            className="col-span-2 rounded-xl opacity-95 sm:col-span-1"
            onClick={() => {
              closeModal("walletInfo");
              openModal("withdraw");
            }}
          >
            Withdraw
          </Button>

          {(currentBalance?.mature ?? 0) > BALANCE_WARN && (
            <div className="col-span-2 items-center justify-end">
              <div className="text-text-secondary text-xs font-semibold">
                That's a lot of {kasUnitDisplay}. Consider cold storage.
              </div>
            </div>
          )}
        </div>

        {(currentBalance?.matureUtxoCount ?? 0) > BALANCE_WARN && (
          <div className="mt-3 sm:hidden">
            <div className="text-text-secondary text-center text-xs font-semibold">
              That's a lot of {kasUnitDisplay}. Consider cold storage.
            </div>
          </div>
        )}
      </section>

      {((currentBalance?.matureUtxoCount ?? 0) > 0 ||
        (currentBalance?.pendingUtxoCount ?? 0) > 0) && (
        <section className="border-primary-border bg-primary-bg rounded-2xl border p-4 sm:p-6">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsUtxoExpanded(!isUtxoExpanded)}
            className="hover:bg-secondary-bg -my-2 flex w-full cursor-pointer items-center justify-between rounded-lg p-2 transition-colors"
          >
            <h4 className="text-text-primary text-center text-base font-bold sm:text-left">
              UTXO Information
            </h4>
            {!shouldAutoExpand &&
              (isUtxoExpanded ? (
                <ChevronUp className="text-text-secondary h-5 w-5" />
              ) : (
                <ChevronDown className="text-text-secondary h-5 w-5" />
              ))}
          </button>

          {/* Collapsible Content */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="border-primary-border/60 bg-secondary-bg rounded-xl border px-3 py-2">
                  <div className="text-text-primary text-xs font-semibold uppercase opacity-80">
                    Mature UTXOs
                  </div>
                  <span className="inline-block rounded-xl px-2 py-0.5 font-bold text-[var(--text-primary)]">
                    {frozenBalance?.matureUtxoCount ??
                      currentBalance?.matureUtxoCount ??
                      "-"}
                  </span>
                </div>
                <div className="border-primary-border/60 bg-secondary-bg rounded-xl border px-3 py-2">
                  <div className="text-text-primary text-xs font-semibold uppercase opacity-80">
                    Pending UTXOs
                  </div>
                  <span className="inline-block rounded-xl px-2 py-0.5 font-bold text-[var(--text-primary)]">
                    {currentBalance?.pendingUtxoCount ?? "-"}
                  </span>
                </div>
                <div className="border-primary-border/60 bg-secondary-bg col-span-2 rounded-xl border px-3 py-2 sm:col-span-1">
                  <div className="text-text-primary text-xs font-semibold uppercase opacity-80">
                    Status
                  </div>
                  <div className="font-semibold">
                    {!currentBalance?.matureUtxoCount
                      ? "Initializing..."
                      : "Ready"}
                  </div>
                </div>
              </div>

              <UtxoCompound onFrozenBalanceChange={setFrozenBalance} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
