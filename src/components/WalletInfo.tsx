import { FC, useMemo } from "react";
import { useWalletStore } from "../store/wallet.store";
import { WalletAddressSection } from "./WalletAddressSection";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

type WalletInfoProps = {
  state: "connected" | "loading";
  address?: string;
  isWalletReady?: boolean;
  open: boolean;
  onClose: () => void;
};
export const WalletInfo: FC<WalletInfoProps> = ({
  state,
  address,
  isWalletReady,
  open,
  onClose,
}) => {
  const isAccountServiceRunning = useWalletStore(
    (s) => s.isAccountServiceRunning,
  );
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name,
  );
  const walletBalance = useWalletStore((s) => s.balance);

  const walletInfoNode = useMemo(() => {
    const isInitializing = !isAccountServiceRunning;
    const currentBalance = walletBalance;

    return (
      <>
        <h3 className="text-base font-semibold">Wallet Information</h3>
        <WalletAddressSection address={address} />
        <div className="balance-info">
          <h4>Wallet Name</h4>
          <div className="text-base font-semibold">{unlockedWalletName}</div>
        </div>
        <div className="balance-info">
          <h4>Balance</h4>
          {isInitializing ? (
            <p>
              Click "Start Wallet Service" to load your balance and start
              messaging.
            </p>
          ) : (
            <ul className="balance-list">
              <li>
                <strong>Total:</strong>{" "}
                <span className="amount">
                  {currentBalance?.matureDisplay} KAS
                </span>
              </li>
              <li>
                <strong>Confirmed:</strong>{" "}
                <span className="amount">
                  {currentBalance?.matureDisplay} KAS
                </span>
              </li>
              <li>
                <strong>Unconfirmed:</strong>{" "}
                <span className="amount">
                  {currentBalance?.pendingDisplay} KAS
                </span>
              </li>
              <li>
                <strong>Outgoing:</strong>{" "}
                <span className="amount">
                  {currentBalance?.outgoingDisplay} KAS
                </span>
              </li>
            </ul>
          )}
        </div>

        <div className="balance-info">
          <h4>UTXO Information</h4>
          {isInitializing ? (
            <p>Waiting for wallet service to start...</p>
          ) : (
            <ul className="balance-list">
              <li>
                <strong>Mature UTXOs:</strong>{" "}
                <span className="utxo-count">
                  {currentBalance?.matureUtxoCount ?? "-"}
                </span>
              </li>
              <li>
                <strong>Pending UTXOs:</strong>{" "}
                <span className="utxo-count">
                  {currentBalance?.pendingUtxoCount ?? "-"}
                </span>
              </li>
              <li>
                <strong>Status:</strong>{" "}
                <span className="status">
                  {!currentBalance?.matureUtxoCount
                    ? "Initializing..."
                    : "Ready"}
                </span>
              </li>
            </ul>
          )}
        </div>
      </>
    );
  }, [isAccountServiceRunning, walletBalance, address]);

  const loadingWalletNode = (
    <div className="flex justify-center items-center">
      <ArrowPathIcon className="w-12 h-12 animate-spin text-gray-300" />
    </div>
  );

  if (!isWalletReady || !open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-[var(--secondary-bg)] p-5 rounded-xl relative max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto border border-[var(--border-color)] animate-[modalFadeIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <div>{state === "connected" ? walletInfoNode : loadingWalletNode}</div>
      </div>
    </div>
  );
};
