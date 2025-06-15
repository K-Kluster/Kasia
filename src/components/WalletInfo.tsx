import { FC, useMemo, useState, useEffect, useRef } from "react";
import { formatKasAmount } from "../utils/format";
import { FeeBuckets } from "./FeeBuckets";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";
import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { sendTransaction } from '../service/account-service';

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
  balance,
  isWalletReady
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBlurred, setIsBlurred] = useState(true);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const isAccountServiceRunning = useWalletStore(state => state.isAccountServiceRunning);
  const walletBalance = useWalletStore(state => state.balance);
  const selectedWalletId = useWalletStore(state => state.selectedWalletId);
  const wallets = useWalletStore(state => state.wallets);

  // Add new state for withdraw functionality
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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

      const wallets = JSON.parse(walletsString);
      const wallet = wallets.find((w: any) => w.id === selectedWalletId);
      if (!wallet) {
        setError("Wallet not found");
        return;
      }

      // Decrypt the seed phrase
      const phrase = decryptXChaCha20Poly1305(wallet.encryptedPhrase, password);
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
      console.log('Balance check:', { amount, matureBalanceKAS, walletBalance });
      
      if (amount > matureBalanceKAS) {
        throw new Error(`Insufficient balance. Available: ${matureBalanceKAS.toFixed(8)} KAS`);
      }

      await sendTransaction(withdrawAddress, amount);
      setWithdrawAddress("");
      setWithdrawAmount("");
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Failed to send transaction");
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
        <p>
          <strong>Address:</strong> <span className="address">{address}</span>
        </p>
        <div className="balance-info">
          <h4>Balance</h4>
          {isInitializing ? (
            <p>Click "Start Wallet Service" to load your balance and start messaging.</p>
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
                <span className="utxo-count">{currentBalance?.matureUtxoCount ?? '-'}</span>
              </li>
              <li>
                <strong>Pending UTXOs:</strong>{" "}
                <span className="utxo-count">{currentBalance?.pendingUtxoCount ?? '-'}</span>
            </li>
            <li>
              <strong>Status:</strong>{" "}
                <span className="status">{!currentBalance?.matureUtxoCount ? 'Initializing...' : 'Ready'}</span>
            </li>
          </ul>
          )}
        </div>
        <div className="info-box">
          <h3>Withdraw KAS</h3>
          <div className="withdraw-section" style={{ marginTop: '10px' }}>
            <input
              type="text"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder="Enter Kaspa address"
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'white',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount (KAS)"
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: 'white',
                }}
              />
              <button
                onClick={handleWithdraw}
                disabled={isSending}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196f3',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {withdrawError && (
              <div style={{
                color: '#ff4444',
                marginTop: '8px',
                fontSize: '14px',
                textAlign: 'center',
              }}>
                {withdrawError}
              </div>
            )}
          </div>
        </div>
        <div className="seed-phrase-section">
          <h4>Security</h4>
          <p className="warning">
            Warning: Never share your seed phrase with anyone. Anyone with access to your seed phrase can access your funds.
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
              <div className={`seed-phrase ${isBlurred ? 'blurred' : ''}`}>
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
                  {isBlurred ? '👁️' : '👁️'}
                </label>
              </div>
              <button onClick={() => {
                setShowSeedPhrase(false);
                setSeedPhrase("");
                setPassword("");
                setIsBlurred(true);
              }}>Hide Seed Phrase</button>
            </div>
          )}
        </div>
      </>
    );
  }, [address, walletBalance, isAccountServiceRunning, showSeedPhrase, seedPhrase, password, error, isBlurred, withdrawAddress, withdrawAmount, withdrawError, isSending]);

  if (!isWalletReady) return null;

  return (
    <div className="wallet-info-container">
      <div className="wallet-info-wrapper">
        <FeeBuckets inline={true} />
      <button 
        className="wallet-info-button"
        onClick={() => setIsOpen(true)}
      >
        Wallet Info
      </button>
      </div>

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
