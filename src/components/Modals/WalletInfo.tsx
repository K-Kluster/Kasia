import { useWalletStore } from "../../store/wallet.store";

export const WalletInfo = () => {
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );
  const walletBalance = useWalletStore((s) => s.balance);

  const currentBalance = walletBalance;

  return (
    <div className="m-1">
      <div className="balance-info">
        <h4>Wallet Name</h4>
        <div className="text-base font-semibold">{unlockedWalletName}</div>
      </div>

      <div className="balance-info">
        <h4>Balance</h4>
        <ul className="balance-list">
          <li>
            <strong>Total:</strong>{" "}
            <span className="amount">{currentBalance?.matureDisplay} KAS</span>
          </li>
          <li>
            <strong>Confirmed:</strong>{" "}
            <span className="amount">{currentBalance?.matureDisplay} KAS</span>
          </li>
          <li>
            <strong>Unconfirmed:</strong>{" "}
            <span className="amount">{currentBalance?.pendingDisplay} KAS</span>
          </li>
          <li>
            <strong>Outgoing:</strong>{" "}
            <span className="amount">
              {currentBalance?.outgoingDisplay} KAS
            </span>
          </li>
        </ul>
      </div>

      <div className="balance-info">
        <h4>UTXO Information</h4>
        <ul className="balance-list">
          <li>
            <strong>Mature UTXOs:</strong>{" "}
            <span className="rounded-xl bg-[var(--accent-blue)] px-2 font-bold text-[var(--text-primary)]">
              {currentBalance?.matureUtxoCount ?? "-"}
            </span>
          </li>
          <li>
            <strong>Pending UTXOs:</strong>{" "}
            <span className="rounded-xl bg-[var(--accent-blue)] px-2 font-bold text-[var(--text-primary)]">
              {currentBalance?.pendingUtxoCount ?? "-"}
            </span>
          </li>
          <li>
            <strong>Status:</strong>{" "}
            <span className="status">
              {!currentBalance?.matureUtxoCount ? "Initializing..." : "Ready"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
