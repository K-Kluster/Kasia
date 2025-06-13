import { useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { WalletStorage } from "../utils/wallet-storage";
import "./WalletGuard.css";
import { NetworkSelector } from "./NetworkSelector";
import { NetworkType } from "../type/all";

type Step = {
  type: "home" | "create" | "import" | "unlock" | "finalizing";
  mnemonic?: Mnemonic;
  name?: string;
    };

type WalletGuardProps = {
  onSuccess: () => void;
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
};

export const WalletGuard = ({ onSuccess, selectedNetwork, onNetworkChange, isConnected }: WalletGuardProps) => {
  const [step, setStep] = useState<Step>({ type: "home" });
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mnemonicRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const {
    wallets,
    selectedWalletId,
    unlockedWallet,
    loadWallets,
    selectWallet,
    createWallet,
    deleteWallet,
    unlock,
    lock,
    selectedNetwork: currentSelectedNetwork
  } = useWalletStore();

  useEffect(() => {
    setIsMounted(true);
    loadWallets();
    return () => setIsMounted(false);
  }, [loadWallets]);

  useEffect(() => {
    if (unlockedWallet) {
      setStep({ type: "finalizing", mnemonic: undefined });
      onSuccess();
    }
  }, [unlockedWallet, onSuccess]);

  if (!isMounted) return null;

  const onClickStep = (type: Step["type"]) => {
    setStep({ type });
    setError(null);
  };

  const onCreateWallet = async () => {
    if (!nameRef.current?.value || !passwordRef.current?.value) {
      setError("Please enter a name and password");
      return;
    }

    try {
      const mnemonic = Mnemonic.random();
      await createWallet(nameRef.current.value, mnemonic, passwordRef.current.value);
      setStep({ type: "finalizing", mnemonic });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    }
  };

  const onImportWallet = async () => {
    if (!nameRef.current?.value || !mnemonicRef.current?.value || !passwordRef.current?.value) {
      setError("Please enter all fields");
      return;
    }

    try {
      const mnemonic = new Mnemonic(mnemonicRef.current.value);
      await createWallet(nameRef.current.value, mnemonic, passwordRef.current.value);
      setStep({ type: "finalizing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid mnemonic");
    }
  };

  const onUnlockWallet = async () => {
    if (!selectedWalletId || !passwordRef.current?.value) {
      setError("Please enter your wallet password");
      return;
    }

    try {
      await unlock(selectedWalletId, passwordRef.current.value);
    } catch (err) {
      console.error("Unlock error:", err);
      // Clear the password field and focus it
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
      // Show user-friendly error message
      if (err instanceof Error && err.message.toLowerCase().includes("invalid password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Failed to unlock wallet. Please try again.");
      }
    }
  };

  const onDeleteWallet = (walletId: string) => {
    if (window.confirm("Are you sure you want to delete this wallet?")) {
      deleteWallet(walletId);
    }
  };

  const onSelectWallet = (wallet: any) => {
    selectWallet(wallet.id);
    setStep({ type: "unlock" });
  };

  if (step.type === "home") {
    return (
      <div className="wallet-guard">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
        <h2>Select Wallet</h2>
          <div className="wallet-list">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="wallet-item">
                <div className="wallet-info">
                <div className="wallet-name">{wallet.name}</div>
                <div className="wallet-created">Created: {new Date(wallet.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="wallet-actions">
                <button onClick={() => onSelectWallet(wallet)} className="select-button">
                  Select
                </button>
                <button onClick={() => onDeleteWallet(wallet.id)} className="delete-button">
                  Delete
                </button>
                </div>
              </div>
            ))}
          </div>
        <div className="wallet-options">
          <button onClick={() => onClickStep("create")} className="create-wallet-button">
            Create New Wallet
          </button>
          <button onClick={() => onClickStep("import")} className="import-wallet-button">
            Import Wallet
          </button>
        </div>
      </div>
    );
  }

  if (step.type === "create" || step.type === "import") {
    return (
      <div className="wallet-guard">
        <h2>{step.type === "create" ? "Create New Wallet" : "Import Wallet"}</h2>
        <div className="form-group">
          <label>Wallet Name</label>
          <input ref={nameRef} type="text" placeholder="My Wallet" />
        </div>
        {step.type === "import" && (
          <div className="form-group">
            <label>Mnemonic Phrase</label>
            <div className="mnemonic-input-grid">
              {Array.from({ length: 24 }, (_, i) => (
                <input
                  key={i}
                  type="password"
                  placeholder={`Word ${i + 1}`}
                  className="mnemonic-word-input"
                  data-index={i}
                  onPaste={(e) => {
                    if (i === 0) {
                      e.preventDefault();
                      const pastedText = e.clipboardData.getData('text');
                      const words = pastedText.trim().split(/\s+/);
                      
                      const inputElement = e.target as HTMLInputElement;
                      const allInputs = inputElement.parentElement?.querySelectorAll('input');
                      if (!allInputs) return;

                      words.slice(0, 24).forEach((word, index) => {
                        if (allInputs[index]) {
                          (allInputs[index] as HTMLInputElement).value = word;
                        }
                      });

                      if (mnemonicRef.current) {
                        mnemonicRef.current.value = words.slice(0, 24).join(' ');
                      }
                    }
                  }}
                  onChange={(e) => {
                    const inputElement = e.target as HTMLInputElement;
                    const allInputs = inputElement.parentElement?.querySelectorAll('input') || [];
                    const words = Array.from(allInputs).map(input => input.value).join(' ');
                    if (mnemonicRef.current) {
                      mnemonicRef.current.value = words;
                    }
                  }}
                />
              ))}
            </div>
            <textarea 
              ref={mnemonicRef} 
              style={{ display: 'none' }}
            />
          </div>
        )}
        <div className="form-group">
          <label>Password</label>
          <input ref={passwordRef} type="password" placeholder="Enter password" />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button onClick={() => onClickStep("home")}>Back</button>
          <button onClick={step.type === "create" ? onCreateWallet : onImportWallet}>
            {step.type === "create" ? "Create" : "Import"}
          </button>
        </div>
      </div>
    );
  }

  if (step.type === "unlock") {
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    return (
      <div className="wallet-guard">
        <h2>Unlock Wallet</h2>
        {selectedWallet && (
          <div className="selected-wallet-info">
            <span className="wallet-name">{selectedWallet.name}</span>
          </div>
        )}
        <div className="form-group">
          <label>Password</label>
          <input 
            ref={passwordRef} 
            type="password" 
            placeholder="Enter your password" 
            className={error ? "error" : ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUnlockWallet();
              }
            }}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button onClick={() => onClickStep("home")}>Back</button>
        <button onClick={onUnlockWallet}>Unlock</button>
        </div>
      </div>
    );
  }

  if (step.type === "finalizing") {
    return (
      <div className="wallet-guard">
        <h2>{step.mnemonic ? "Wallet Created Successfully!" : "Wallet Unlocked!"}</h2>
        {step.type === "finalizing" && step.mnemonic && (
          <div className="mnemonic-display">
            <p>Please save your mnemonic phrase securely:</p>
            <div className="warning-message">
              ⚠️ This is the only time you will see your seed phrase - back it up now!
            </div>
            <div className="show-phrase-toggle">
              <input 
                type="checkbox" 
                id="showPhrase"
                onChange={(e) => {
                  const phraseElement = document.querySelector('.mnemonic-phrase');
                  if (phraseElement) {
                    phraseElement.classList.toggle('visible', e.target.checked);
                  }
                }}
              />
              <label htmlFor="showPhrase">I understand that anyone with my seed phrase can access my wallet. Show seed phrase</label>
            </div>
            <div className="mnemonic-phrase">
              {step.mnemonic.phrase.split(' ').map((word, i) => (
                <span key={i} className="mnemonic-word">
                  <span className="word-number">{i + 1}.</span> {word}
                </span>
              ))}
            </div>
            <button 
              className="copy-button"
              onClick={() => {
                const words = step.mnemonic?.phrase || '';
                navigator.clipboard.writeText(words).then(() => {
                  const btn = document.querySelector('.copy-button') as HTMLButtonElement;
                  if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 2000);
                  }
                });
              }}
            >
              Copy Seed Phrase
            </button>
          </div>
        )}
        <button onClick={() => onClickStep("home")}>Back to Wallets</button>
      </div>
    );
  }

  return null;
};
