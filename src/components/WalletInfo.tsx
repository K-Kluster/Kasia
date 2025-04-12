import { FC, useMemo } from "react";
import { formatKasAmount } from "../utils/format";

type WalletInfoProps = {
  state: "connected" | "detected" | "not-detected";
  address?: string;
  utxoCount?: number;
  pendingBalance?: number;
  matureBalance?: number;
  totalBalance?: number;
};

export const WalletInfo: FC<WalletInfoProps> = ({
  state,
  address,
  utxoCount,
  pendingBalance,
  matureBalance,
  totalBalance,
}) => {
  const walletInfoNode = useMemo(() => {
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
              <span className="amount">
                {formatKasAmount(matureBalance ?? 0)} KAS
              </span>
            </li>
            <li>
              <strong>Unconfirmed:</strong>{" "}
              <span className="amount">
                {formatKasAmount(pendingBalance ?? 0)} KAS
              </span>
            </li>
          </ul>
        </div>
        <p>
          <strong>UTXO Entries:</strong>{" "}
          <span className="utxo-count">{utxoCount}</span>
        </p>
      </>
    );
  }, [address, totalBalance, matureBalance, pendingBalance, utxoCount]);

  return (
    <div className="data-container">
      <div className="info-message">
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
  );
};
