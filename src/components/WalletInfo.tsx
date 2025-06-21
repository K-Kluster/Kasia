import { FC, useMemo, useState, useEffect, useCallback } from "react";
import { useWalletStore } from "../store/wallet.store";
import { toDataURL } from "qrcode";
import { WalletSeedRetreiveDisplay } from "../containers/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../containers/WalletWithdrawal";
import { WalletAddressSection } from "./WalletAddressSection";

type WalletInfoProps = {
  state: "connected" | "detected" | "not-detected";
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
  const [copyNotification, setCopyNotification] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeURL, setQRCodeURL] = useState<string | null>(null);

  const isAccountServiceRunning = useWalletStore(
    (s) => s.isAccountServiceRunning
  );
  const walletBalance = useWalletStore((s) => s.balance);

  useEffect(() => {
    if (!address) return;
    toDataURL(address, (err, uri) => {
      if (!err) setQRCodeURL(uri);
    });
  }, [address]);

  // Add handler for copy to clipboard
  const handleCopyAddress = async () => {
    console.log("Copy button clicked!");

    if (!address) {
      console.log("No address to copy");
      setCopyNotification("No address available");
      setTimeout(() => setCopyNotification(""), 3000);
      return;
    }

    console.log("Address to copy:", address);

    // Try the modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        console.log("Using modern clipboard API");
        await navigator.clipboard.writeText(address);
        console.log("Modern clipboard API successful");
        setCopyNotification("Address copied to clipboard!");
        setTimeout(() => setCopyNotification(""), 3000);
        return;
      } catch (error) {
        console.log("Modern clipboard API failed:", error);
      }
    }

    // Fallback method
    console.log("Using fallback copy method");
    try {
      const textArea = document.createElement("textarea");
      textArea.value = address;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999); // For mobile devices

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        console.log("Fallback copy successful");
        setCopyNotification("Address copied to clipboard!");
        setTimeout(() => setCopyNotification(""), 3000);
      } else {
        console.log("Fallback copy failed");
        setCopyNotification("Copy failed - please copy manually");
        setTimeout(() => setCopyNotification(""), 3000);
      }
    } catch (fallbackError) {
      console.error("Fallback copy method failed:", fallbackError);
      setCopyNotification("Copy failed - please copy manually");
      setTimeout(() => setCopyNotification(""), 3000);
    }
  };

  // Add handler for QR code generation
  const handleShowQRCode = useCallback(() => {
    console.log("QR button clicked, current state:", showQRCode);
    setShowQRCode(!showQRCode);
  }, [showQRCode]);

  const walletInfoNode = useMemo(() => {
    // Only show initialization state if the service isn't running
    const isInitializing = !isAccountServiceRunning;

    // Use the wallet store's balance as the source of truth
    const currentBalance = walletBalance;

    return (
      <>
        <h3>Wallet Information</h3>
        <WalletAddressSection address={address} />
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

        <div className="info-box">
          <WalletWithdrawal walletBalance={walletBalance} />
        </div>

        <div className="seed-phrase-section">
          <WalletSeedRetreiveDisplay />
        </div>
      </>
    );
  }, [
    isAccountServiceRunning,
    walletBalance,
    address,
    copyNotification,
    showQRCode,
    qrCodeURL,
    handleShowQRCode,
  ]);

  if (!isWalletReady || !open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <div className="modal-body">
          {state === "connected"
            ? walletInfoNode
            : state === "detected"
            ? "KasWare Wallet detected. Click \"Connect to Kasware\" to view your transactions."
            : "Kasware Wallet not detected. Please install Kasware Wallet."}
        </div>
      </div>

      <style>
        {`
        .seed-phrase-section {
          margin-top: 20px;
          padding: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .seed-phrase {
          background: rgba(0, 0, 0, 0.3);
          padding: 15px;
          border-radius: 5px;
          margin: 10px 0;
          word-break: break-all;
          font-family: monospace;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: filter 0.2s ease;
        }
        .seed-phrase.blurred {
          filter: blur(5px);
          user-select: none;
        }
        .warning {
          color: #ff4444;
          font-size: 0.9em;
          margin: 10px 0;
          text-align: center;
        }
        .visibility-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 5px;
        }
        .visibility-toggle input[type="checkbox"] {
          display: none;
        }
        .eye-icon {
          cursor: pointer;
          user-select: none;
          font-size: 20px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .eye-icon:hover {
          opacity: 1;
        }
        .error {
          color: #ff4444;
          margin-top: 5px;
        }
        .seed-phrase-section input {
          width: 100%;
          padding: 8px;
          margin: 10px 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
          color: #fff;
        }
        .seed-phrase-section input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .seed-phrase-section button {
          background: #2196f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
          transition: background-color 0.2s;
        }
        .seed-phrase-section button:hover {
          background: #1976d2;
        }
        `}
      </style>
    </div>
  );
};
