import { useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { WalletStorage } from "../utils/wallet-storage";
import "./WalletGuard.css";

type Step = {
  type: "home" | "create" | "import" | "unlock" | "finalizing";
  mnemonic?: Mnemonic;
  name?: string;
    };

type WalletGuardProps = {
  onSuccess: () => void;
};

export const WalletGuard = ({ onSuccess }: WalletGuardProps) => {
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
    lock
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
      setError("Please select a wallet and enter password");
      return;
    }

    try {
      await unlock(selectedWalletId, passwordRef.current.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    }
  };

  const onDeleteWallet = (walletId: string) => {
    if (window.confirm("Are you sure you want to delete this wallet?")) {
      deleteWallet(walletId);
    }
  };

  if (step.type === "home") {
    return (
      <div className="wallet-guard">
        <h2>Select Wallet</h2>
        {wallets.length > 0 ? (
          <div className="wallet-list">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="wallet-item">
                <div className="wallet-info">
                  <h3>{wallet.name}</h3>
                  <p>Created: {new Date(wallet.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="wallet-actions">
                  <button onClick={() => {
                    selectWallet(wallet.id);
                    setStep({ type: "unlock" });
                  }}>Select</button>
                  <button onClick={() => onDeleteWallet(wallet.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No wallets found. Create or import a wallet to get started.</p>
        )}
        <div className="wallet-actions">
          <button onClick={() => onClickStep("create")}>Create New Wallet</button>
            <button onClick={() => onClickStep("import")}>Import Wallet</button>
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
    return (
      <div className="wallet-guard">
        <h2>Unlock Wallet</h2>
        <div className="form-group">
          <label>Password</label>
          <input ref={passwordRef} type="password" placeholder="Enter password" />
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
