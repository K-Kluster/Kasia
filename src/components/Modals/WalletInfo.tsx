import { useWalletStore } from "../../store/wallet.store";

export const WalletInfo = () => {
  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );
  const walletBalance = useWalletStore((s) => s.balance);

  const currentBalance = walletBalance;

  return (
    <div className="m-4">
      <div className="border-kas-secondary bg-kas-secondary/5 mb-4 rounded-2xl border p-4">
        <h4 className="text-kas-secondary font-bold">Wallet Name:</h4>
        <div className="text-base font-semibold">{unlockedWalletName}</div>
      </div>

      <div className="border-primary-border bg-primary-bg mb-4 rounded-2xl border p-4">
        <h4 className="mb-2 font-bold">Balance</h4>
        <ul className="m-0 list-none p-0 text-sm">
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

      <div className="border-primary-border bg-primary-bg mb-4 rounded-2xl border p-4">
        <h4 className="mb-2 font-bold">UTXO Information</h4>
        <ul className="m-0 list-none p-0 text-sm">
          <li>
            <strong>Mature UTXOs:</strong>{" "}
            <span className="rounded-xl bg-[var(--kas-primary)] px-2 font-bold text-[var(--text-primary)]">
              {currentBalance?.matureUtxoCount ?? "-"}
            </span>
          </li>
          <li>
            <strong>Pending UTXOs:</strong>{" "}
            <span className="rounded-xl bg-[var(--kas-primary)] px-2 font-bold text-[var(--text-primary)]">
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
