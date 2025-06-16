import { FC, useMemo, useState, useEffect, useRef } from "react";
import { formatKasAmount } from "../utils/format";
import { FeeBuckets } from "./FeeBuckets";
import { useWalletStore } from "../store/wallet.store";
import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { sendTransaction } from "../service/account-service";
import { toDataURL } from "qrcode";
import { StoredWallet, Wallet } from "src/types/wallet.type";

type WalletInfoProps = {
  state: "connected" | "detected" | "not-detected";
  address?: string;
  balance?: {
    mature: number;
    pending: number;
    outgoing: number;
    matureUtxoCount: number;
    pendingUtxoCount: number;
  } | null;
  isWalletReady?: boolean;
};

export const WalletInfo: FC<WalletInfoProps> = ({
  state,
  address,
  isWalletReady,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBlurred, setIsBlurred] = useState(true);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAccountServiceRunning = useWalletStore(
    (state) => state.isAccountServiceRunning
  );
  const walletBalance = useWalletStore((state) => state.balance);
  const selectedWalletId = useWalletStore((state) => state.selectedWalletId);
  const wallets = useWalletStore((state) => state.wallets);

  // Add new state for withdraw functionality
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copyNotification, setCopyNotification] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeURL, setQRCodeURL] = useState<string | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!address) {
      return;
    }

    toDataURL(address ?? "", (error, uriData) => {
      if (error) {
        console.error(error);
        return;
      }

      setQRCodeURL(uriData);
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
  const handleShowQRCode = () => {
    console.log("QR button clicked, current state:", showQRCode);
    setShowQRCode(!showQRCode);
  };

  const handleBlurToggle = (shouldBlur: boolean) => {
    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    setIsBlurred(shouldBlur);

    // If unblurring, set a timeout to re-blur after 5 seconds
    if (!shouldBlur) {
      blurTimeoutRef.current = setTimeout(() => {
        setIsBlurred(true);
      }, 5000);
    }
  };

  const handleViewSeedPhrase = async () => {
    try {
      setError("");
      if (!selectedWalletId) {
        setError("No wallet selected");
        return;
      }

      // Get the stored wallet data
      const walletsString = localStorage.getItem("wallets");
      if (!walletsString) {
        setError("No wallets found");
        return;
      }

      const storedWallets: StoredWallet[] = JSON.parse(walletsString);
      const foundStoredWallet = storedWallets.find(
        (w) => w.id === selectedWalletId
      );
      if (!foundStoredWallet) {
        setError("Wallet not found");
        return;
      }

      // Decrypt the seed phrase
      const phrase = decryptXChaCha20Poly1305(
        foundStoredWallet.encryptedPhrase,
        password
      );
      setSeedPhrase(phrase);
      setShowSeedPhrase(true);
    } catch (error) {
      console.error("Error viewing seed phrase:", error);
      setError("Invalid password");
    }
  };

  // Add handler for withdraw
  const handleWithdraw = async () => {
    try {
      setWithdrawError("");
      setIsSending(true);

      if (!withdrawAddress || !withdrawAmount) {
        throw new Error("Please enter both address and amount");
      }

      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Use mature balance directly since it's already in KAS
      const matureBalanceKAS = walletBalance?.mature || 0;
      console.log("Balance check:", {
        amount,
        matureBalanceKAS,
        walletBalance,
      });

      if (amount > matureBalanceKAS) {
        throw new Error(
          `Insufficient balance. Available: ${matureBalanceKAS.toFixed(8)} KAS`
        );
      }

      await sendTransaction(withdrawAddress, amount);
      setWithdrawAddress("");
      setWithdrawAmount("");
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to send transaction"
      );
    } finally {
      setIsSending(false);
    }
  };

  const walletInfoNode = useMemo(() => {
    // Only show initialization state if the service isn't running
    const isInitializing = !isAccountServiceRunning;

    // Use the wallet store's balance as the source of truth
    const currentBalance = walletBalance;

    return (
      <>
        <h3>Wallet Information</h3>
        <div className="address-section">
          <strong>Address:</strong>
          <div className="address-row">
            <div className="address-info">
              <span
                className="address"
                id="wallet-address"
                onClick={() => {
                  // Select the text when clicked
                  const selection = window.getSelection();
                  const range = document.createRange();
                  const addressElement =
                    document.getElementById("wallet-address");
                  if (addressElement && selection) {
                    range.selectNodeContents(addressElement);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                }}
                title="Click to select address"
              >
                {address}
              </span>
            </div>
            <div className="address-actions">
              <button
                className="copy-button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  if (!address) {
                    setCopyNotification("No address available");
                    setTimeout(() => setCopyNotification(""), 3000);
                    return;
                  }

                  try {
                    await navigator.clipboard.writeText(address);
                    setCopyNotification("Address copied!");
                    setTimeout(() => setCopyNotification(""), 3000);
                  } catch (error) {
                    try {
                      const textArea = document.createElement("textarea");
                      textArea.value = address;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-9999px";
                      textArea.style.top = "-9999px";
                      textArea.style.opacity = "0";
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      textArea.setSelectionRange(0, 99999);

                      const success = document.execCommand("copy");
                      document.body.removeChild(textArea);

                      if (success) {
                        setCopyNotification("Address copied!");
                        setTimeout(() => setCopyNotification(""), 3000);
                      } else {
                        setCopyNotification("Copy failed");
                        setTimeout(() => setCopyNotification(""), 3000);
                      }
                    } catch (fallbackError) {
                      setCopyNotification("Copy failed");
                      setTimeout(() => setCopyNotification(""), 3000);
                    }
                  }
                }}
                title="Copy address to clipboard"
                type="button"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button
                className="qr-button"
                onClick={() => {
                  handleShowQRCode();
                }}
                title="Show QR code"
                type="button"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="5" height="5"></rect>
                  <rect x="16" y="3" width="5" height="5"></rect>
                  <rect x="3" y="16" width="5" height="5"></rect>
                  <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                  <path d="M21 21v.01"></path>
                  <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                  <path d="M3 12h.01"></path>
                  <path d="M12 3h.01"></path>
                  <path d="M12 16v.01"></path>
                  <path d="M16 12h1"></path>
                  <path d="M21 12v.01"></path>
                  <path d="M12 21v-1"></path>
                </svg>
              </button>
            </div>
          </div>
          {copyNotification && (
            <div className="copy-notification">{copyNotification}</div>
          )}
          {showQRCode && address && qrCodeURL && (
            <div className="qr-code-section">
              <h4>QR Code for Address</h4>
              <div className="qr-code-container">
                <img
                  src={qrCodeURL}
                  alt="QR Code for wallet address"
                  className="qr-code-image"
                  onLoad={() =>
                    console.log("QR code image loaded successfully")
                  }
                  onError={(e) => {
                    console.error("QR code image failed to load:", e);
                    console.log("Failed URL:", qrCodeURL);
                  }}
                />
                <p className="qr-code-text">Scan to get wallet address</p>
              </div>
            </div>
          )}
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
                  {formatKasAmount(currentBalance?.mature ?? 0)} KAS
                </span>
              </li>
              <li>
                <strong>Confirmed:</strong>{" "}
                <span className="amount">
                  {formatKasAmount(currentBalance?.mature ?? 0)} KAS
                </span>
              </li>
              <li>
                <strong>Unconfirmed:</strong>{" "}
                <span className="amount">
                  {formatKasAmount(currentBalance?.pending ?? 0)} KAS
                </span>
              </li>
              <li>
                <strong>Outgoing:</strong>{" "}
                <span className="amount">
                  {formatKasAmount(currentBalance?.outgoing ?? 0)} KAS
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
          <h3>Withdraw KAS</h3>
          <div className="withdraw-section" style={{ marginTop: "10px" }}>
            <input
              type="text"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder="Enter Kaspa address"
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                color: "white",
              }}
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount (KAS)"
                style={{
                  flex: 1,
                  padding: "8px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  color: "white",
                }}
              />
              <button
                onClick={handleWithdraw}
                disabled={isSending}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#2196f3",
                  border: "none",
                  borderRadius: "4px",
                  color: "white",
                  cursor: "pointer",
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            {withdrawError && (
              <div
                style={{
                  color: "#ff4444",
                  marginTop: "8px",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                {withdrawError}
              </div>
            )}
          </div>
        </div>
        <div className="seed-phrase-section">
          <h4>Security</h4>
          <p className="warning">
            Warning: Never share your seed phrase with anyone. Anyone with
            access to your seed phrase can access your funds.
          </p>
          {!showSeedPhrase ? (
            <div>
              <p>Enter your password to view seed phrase:</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter wallet password"
              />
              <button onClick={handleViewSeedPhrase}>View Seed Phrase</button>
              {error && <p className="error">{error}</p>}
            </div>
          ) : (
            <div>
              <p>Your seed phrase:</p>
              <div className={`seed-phrase ${isBlurred ? "blurred" : ""}`}>
                {seedPhrase}
              </div>
              <div className="visibility-toggle">
                <input
                  type="checkbox"
                  id="toggleVisibility"
                  checked={!isBlurred}
                  onChange={(e) => handleBlurToggle(!e.target.checked)}
                />
                <label htmlFor="toggleVisibility" className="eye-icon">
                  {isBlurred ? "👁️" : "👁️"}
                </label>
              </div>
              <button
                onClick={() => {
                  setShowSeedPhrase(false);
                  setSeedPhrase("");
                  setPassword("");
                  setIsBlurred(true);
                }}
              >
                Hide Seed Phrase
              </button>
            </div>
          )}
        </div>
      </>
    );
  }, [
    address,
    walletBalance,
    isAccountServiceRunning,
    showSeedPhrase,
    seedPhrase,
    password,
    error,
    isBlurred,
    withdrawAddress,
    withdrawAmount,
    withdrawError,
    isSending,
    copyNotification,
    showQRCode,
    handleCopyAddress,
    handleShowQRCode,
    qrCodeURL,
  ]);

  if (!isWalletReady) return null;

  return (
    <div className="wallet-info-container">
      <div className="wallet-info-wrapper">
        <FeeBuckets inline={true} />
        <button className="wallet-info-button" onClick={() => setIsOpen(true)}>
          Wallet Info
        </button>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setIsOpen(false)}>
              ×
            </button>
            <div className="modal-body">
              {state === "connected" ? (
                walletInfoNode
              ) : state === "detected" ? (
                <p>
                  KasWare Wallet detected. Click "Connect to Kasware" to view
                  your transactions.
                </p>
              ) : (
                "Kasware Wallet not detected. Please install Kasware Wallet."
              )}
            </div>
          </div>
        </div>
      )}

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
        .address-section {
          position: relative;
        }
        .address-section {
          margin-bottom: 20px;
        }
        .address-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .address-info {
          flex: 1;
          min-width: 0;
        }
        .address {
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 6px;
          transition: background-color 0.2s;
          user-select: all;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-family: monospace;
          font-size: 13px;
          word-break: break-all;
          line-height: 1.4;
          width: 100%;
          display: block;
          height: 40px;
          display: flex;
          align-items: center;
        }
        .address:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .address-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }
        .address-actions .copy-button, 
        .address-actions .qr-button {
          background-color: #2196f3 !important;
          background: #2196f3 !important;
          border: 1px solid #2196f3 !important;
          border-radius: 4px;
          color: white !important;
          cursor: pointer !important;
          padding: 0 !important;
          margin: 0 !important;
          transition: all 0.2s ease;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 40px !important;
          height: 40px !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          outline: none;
          position: relative;
          z-index: 10;
          pointer-events: auto !important;
          flex-shrink: 0;
          opacity: 1 !important;
        }
        .address-actions .copy-button:hover, 
        .address-actions .qr-button:hover {
          background-color: #1976d2 !important;
          background: #1976d2 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border-color: #1976d2 !important;
        }
        .address-actions .copy-button:active, 
        .address-actions .qr-button:active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          background-color: #1565c0 !important;
          background: #1565c0 !important;
        }
        .address-actions .copy-button:focus, 
        .address-actions .qr-button:focus {
          outline: 2px solid rgba(33, 150, 243, 0.5);
          outline-offset: 2px;
        }
        .address-actions .copy-button svg, 
        .address-actions .qr-button svg {
          width: 18px;
          height: 18px;
          stroke: white !important;
          fill: none !important;
          opacity: 1;
          color: white !important;
        }
        .copy-notification {
          position: absolute;
          top: 100%;
          left: 0;
          background: #4caf50;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 1000;
          animation: fadeInOut 3s ease-in-out;
          white-space: nowrap;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .qr-code-section {
          margin-top: 20px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .qr-code-section h4 {
          margin: 0 0 15px 0;
          color: white;
          text-align: center;
        }
        .qr-code-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .qr-code-image {
          background: white;
          padding: 10px;
          border-radius: 8px;
          max-width: 200px;
          height: auto;
        }
        .qr-code-text {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          margin: 0;
          text-align: center;
        }
        `}
      </style>
    </div>
  );
};
