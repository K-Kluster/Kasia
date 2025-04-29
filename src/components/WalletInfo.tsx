import { FC, useMemo, useState } from "react";
import { formatKasAmount } from "../utils/format";

type WalletInfoProps = {
  state: "connected" | "detected" | "not-detected";
  address?: string;
  utxoCount?: number;
  pendingBalance?: number;
  matureBalance?: number;
  totalBalance?: number;
  isWalletReady?: boolean;
};

// @TODO: finish to plug other infos
export const WalletInfo: FC<WalletInfoProps> = ({
  state,
  address,
  utxoCount,
  pendingBalance,
  matureBalance,
  totalBalance,
  isWalletReady
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const walletInfoNode = useMemo(() => {
    console.log('WalletInfo - Rendering with UTXO count:', utxoCount);
    return (
      <>
        <h3>Wallet Information</h3>
        <p>
          <strong>Address:</strong> <span className="address">{address}</span>
        </p>
        <div className="balance-info">
          <h4>Balance</h4>
          <ul className="balance-list">
            <li>
              <strong>Total:</strong>{" "}
              <span className="amount">
                {formatKasAmount(totalBalance ?? 0)} KAS
              </span>
            </li>
            <li>
              <strong>Confirmed:</strong>{" "}
              <span className="amount">{formatKasAmount(matureBalance ?? 0)} KAS</span>
            </li>
            <li>
              <strong>Unconfirmed:</strong>{" "}
              <span className="amount">
                {formatKasAmount(pendingBalance ?? 0)} KAS
              </span>
            </li>
          </ul>
        </div>
        <div className="balance-info">
          <h4>UTXO Information</h4>
          <ul className="balance-list">
            <li>
              <strong>Mature UTXOs:</strong>{" "}
              <span className="utxo-count">{utxoCount ?? '-'}</span>
            </li>
            <li>
              <strong>Status:</strong>{" "}
              <span className="status">{!utxoCount ? 'Initializing...' : 'Ready'}</span>
            </li>
          </ul>
        </div>
      </>
    );
  }, [address, totalBalance, matureBalance, pendingBalance, utxoCount]);

  if (!isWalletReady) return null;

  return (
    <div className="wallet-info-container">
      <button 
        className="wallet-info-button"
        onClick={() => setIsOpen(true)}
      >
        Wallet Info
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setIsOpen(false)}>×</button>
            <div className="modal-body">
              {state === "connected" ? (
                walletInfoNode
              ) : state === "detected" ? (
                <p>
                  KasWare Wallet detected. Click "Connect to Kasware" to view your
                  transactions.
                </p>
              ) : (
                "Kasware Wallet not detected. Please install Kasware Wallet."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
