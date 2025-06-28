import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import "./WalletFlow.css";
import { NetworkSelector } from "./NetworkSelector";
import { NetworkType } from "../types/all";
import { Wallet, WalletDerivationType } from "src/types/wallet.type";
import {
  PASSWORD_MIN_LENGTH,
  disablePasswordRequirements,
} from "../config/password";
import { MnemonicEntry } from "../components/MnemonicEntry";
import {
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Link, useParams, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { TrustMessage } from "../components/Layout/TrustMessage";
import { toast } from "../utils/toast";

export type Step = {
  type:
    | "home"
    | "create"
    | "import"
    | "unlock"
    | "migrate"
    | "seed"
    | "success"
    | "unlocked";
  mnemonic?: Mnemonic;
  name?: string;
  walletId?: string;
};

type WalletFlowProps = {
  initialStep: Step["type"];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
};

export const WalletFlow = ({
  initialStep,
  selectedNetwork,
  onNetworkChange,
  isConnected,
}: WalletFlowProps) => {
  const navigate = useNavigate();

  const { wallet } = useParams<{ wallet: string }>();

  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24); // Default to 24 words
  const [derivationType, setDerivationType] =
    useState<WalletDerivationType>("standard");
  const [revealed, setRevealed] = useState(false);

  const [unlocking, setUnlocking] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mnemonicRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const usePasswordRef = useCallback((node: HTMLInputElement | null) => {
    passwordRef.current = node;
    node?.focus();
  }, []);

  const [step, setStep] = useState<Step>({
    type: initialStep,
    walletId: wallet,
  });

  const {
    wallets,
    selectedWalletId,
    unlockedWallet,
    loadWallets,
    selectWallet,
    createWallet,
    deleteWallet,
    unlock,
    migrateLegacyWallet,
  } = useWalletStore();

  useEffect(() => {
    setIsMounted(true);
    loadWallets();
    return () => setIsMounted(false);
  }, [loadWallets]);

  if (!isMounted) return null;

  const onStepChange = (type: Step["type"], walletId?: string) => {
    if (unlockedWallet) return;
    switch (type) {
      case "home":
        navigate("/");
        break;
      case "create":
        navigate("/wallet/create");
        break;
      case "import":
        navigate("/wallet/import");
        break;
      case "unlock":
        navigate(`/wallet/unlock/${walletId ?? ""}`);
        break;
      case "migrate":
        navigate(`/wallet/migrate/${walletId ?? ""}`);
        break;
      case "unlocked":
        navigate(`/${walletId ?? "/"}`);
        break;
      default:
        return;
    }
  };

  const handleCopy = async (): Promise<void> => {
    const text = step.mnemonic!.phrase;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Seed phrase copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const onCreateWallet = async () => {
    if (!nameRef.current?.value || !passwordRef.current?.value) {
      setError("Please enter a name and password");
      return;
    }
    try {
      // Generate mnemonic with specified word count
      // Pass the word count parameter to Mnemonic.random()
      const mnemonic = Mnemonic.random(seedPhraseLength);

      // Verify the mnemonic has the correct word count
      const wordCount = mnemonic.phrase.split(" ").length;
      if (wordCount !== seedPhraseLength) {
        throw new Error(
          `Generated mnemonic has ${wordCount} words, expected ${seedPhraseLength}`
        );
      }

      const pw = passwordRef.current!.value;
      if (!disablePasswordRequirements && pw.length < PASSWORD_MIN_LENGTH) {
        setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
        return;
      }

      const id = await createWallet(
        nameRef.current.value,
        mnemonic,
        pw,
        derivationType
      );
      setStep({ type: "seed", walletId: id, mnemonic });
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  const onImportWallet = async () => {
    if (
      !nameRef.current?.value ||
      !mnemonicRef.current?.value ||
      !passwordRef.current?.value
    ) {
      setError("Please enter all fields");
      return;
    }
    const pw = passwordRef.current!.value;
    if (!disablePasswordRequirements && pw.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    try {
      const mnemonic = new Mnemonic(mnemonicRef.current.value);
      await createWallet(nameRef.current.value, mnemonic, pw, derivationType);
      setStep({ type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid mnemonic");
    } finally {
      if (mnemonicRef.current.value) mnemonicRef.current.value = "";
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  const onUnlockWallet = async () => {
    const pass = passwordRef.current?.value;
    if (!selectedWalletId || !pass) {
      setError("Please enter your wallet password");
      return;
    }

    setError("");
    try {
      setUnlocking(true);
      await unlock(selectedWalletId, pass);
      onStepChange("unlocked", selectedWalletId);
    } catch (err) {
      console.error("Unlock error:", err);
      // Clear the password field and focus it
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
      // Show user-friendly error message
      const msg =
        err instanceof Error &&
        err.message.toLowerCase().includes("invalid password")
          ? "Incorrect password. Please try again."
          : "Failed to unlock wallet. Please try again.";
      setError(msg);
    } finally {
      setUnlocking(false);
    }
  };

  const onMigrateWallet = async () => {
    if (
      !step.walletId ||
      !passwordRef.current?.value ||
      !nameRef.current?.value
    ) {
      setError("Please enter all required fields");
      return;
    }
    try {
      await migrateLegacyWallet(
        step.walletId,
        passwordRef.current!.value,
        nameRef.current!.value
      );
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to migrate wallet");
    } finally {
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  const onDeleteWallet = (walletId: string) => {
    if (window.confirm("Are you sure you want to delete this wallet?")) {
      deleteWallet(walletId);
    }
  };

  const onSelectWallet = (wallet: Wallet) => {
    selectWallet(wallet.id);
    navigate(`wallet/unlock/${wallet.id}`);
  };

  const getDerivationTypeDisplay = (d?: WalletDerivationType) =>
    d === "standard" ? (
      <span className="bg-emerald-500 text-white py-1 px-2 rounded text-xs font-medium">
        Standard (Kaspium Compatible)
      </span>
    ) : (
      <span className="bg-amber-500 text-white py-1 px-2 rounded text-xs font-medium">
        Legacy
      </span>
    );

  const wrapperClass = clsx(
    "sm:max-w-[600px] w-full mx-auto my-8 p-8 bg-[var(--secondary-bg)] rounded-lg border border-[var(--border-color)]",
    {
      relative: step.type === "home", //support the cog!
    }
  );

  return (
    <div className={wrapperClass}>
      {/* Home wallet 'Route' */}
      {step.type === "home" && (
        <>
          <Link to="/settings-network">
            <Cog6ToothIcon className="absolute top-4 right-4 size-6 hover:cursor-pointer hover:opacity-80" />
          </Link>
          <div className="grow flex items-center justify-center mb-1">
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
            />
          </div>
          <TrustMessage />
          <h2 className="text-center mt-4 mb-2 text-[var(--text-primary)] text-[1.5rem] font-semibold">
            {wallets.length <= 0 ? "No Wallets Found" : "Select Wallet"}
          </h2>
          <div className="flex flex-col gap-2 sm:gap-4 mb-4">
            {wallets.map((w) => (
              <div
                key={w.id}
                onClick={() => onSelectWallet(w)}
                className="relative cursor-pointer bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4"
              >
                {/* delete icon top-right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWallet(w.id);
                  }}
                  className="cursor-pointer absolute top-2 right-2 p-1 text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  <TrashIcon className="h-6 w-6" />
                </button>

                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center space-x-1 font-semibold text-[var(--text-primary)]">
                    <span>{w.name}</span>
                  </div>

                  <div className="text-sm text-[var(--text-secondary)]">
                    Created: {new Date(w.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {getDerivationTypeDisplay(w.derivationType)}
                    {w.derivationType === "legacy" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStepChange("migrate", w.id);
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs cursor-pointer transition-colors duration-200 animate-pulse"
                        title="Migrate to standard derivation"
                      >
                        Migrate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 justify-center sm:flex-row-reverse sm:gap-4">
            <button
              onClick={() => onStepChange("create")}
              className="cursor-pointer w-full bg-[var(--accent-blue)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Create New Wallet
            </button>
            <button
              onClick={() => onStepChange("import")}
              className="cursor-pointer w-full bg-[var(--accent-blue)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Import Wallet
            </button>
          </div>
        </>
      )}

      {/* Create wallet 'Route' */}
      {step.type === "create" && (
        <>
          <h2 className="font-bold text-lg text-center">Create New Wallet</h2>

          {/* Derivation Type Selection */}
          <div className="form-group">
            <label>Derivation Standard</label>
            <div className="flex flex-col gap-2 sm:gap-3 mt-2">
              <label className="radio-option">
                <input
                  type="radio"
                  name="derivationType"
                  value="standard"
                  checked={derivationType === "standard"}
                  onChange={(e) =>
                    setDerivationType(e.target.value as WalletDerivationType)
                  }
                />
                <span className="ml-1">Standard (Recommended)</span>
                <small>
                  Compatible with Kaspium and other standard wallets
                </small>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="derivationType"
                  value="legacy"
                  checked={derivationType === "legacy"}
                  onChange={(e) =>
                    setDerivationType(e.target.value as WalletDerivationType)
                  }
                />
                <span className="ml-1">Legacy</span>
                <small>For compatibility with older wallets</small>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Wallet Name</label>
            <input ref={nameRef} type="text" placeholder="My Wallet" />
          </div>

          <div className="form-group">
            <label>Seed Phrase Length</label>
            <div className="flex flex-col gap-2 sm:gap-3 mt-2">
              <label className="radio-option">
                <input
                  type="radio"
                  name="seedLength"
                  value="12"
                  checked={seedPhraseLength === 12}
                  onChange={() => setSeedPhraseLength(12)}
                />
                <span className="ml-1">12 words</span>
                <small>128-bit entropy</small>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="seedLength"
                  value="24"
                  checked={seedPhraseLength === 24}
                  onChange={() => setSeedPhraseLength(24)}
                />
                <span className="ml-1">24 words (Recommended)</span>
                <small>256-bit entropy</small>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter password"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="flex flex-col gap-2 justify-center sm:flex-row-reverse sm:gap-4">
            <button
              onClick={onCreateWallet}
              className="cursor-pointer w-full bg-[var(--accent-blue)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Create
            </button>
            <button
              onClick={() => onStepChange("home")}
              className="cursor-pointer w-full bg-[var(--primary-bg)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Back
            </button>
          </div>
        </>
      )}

      {/* Seed continues from Create without a new path */}
      {step.type === "seed" && step.mnemonic && (
        <>
          <h2 className="font-bold text-lg text-center">Wallet Created</h2>
          <div className="my-5 py-4 px-4 bg-[#1a1f2e] border border-[#2a3042] rounded-lg flex flex-col items-center w-full">
            <p className="font-semibold">
              Please save your mnemonic phrase securely:
            </p>
            <div className="my-2 p-2 text-base rounded-lg flex flex-col items-center text-center text-amber-300">
              <ExclamationTriangleIcon className="w-8 h-8" />
              This is the only time you will see your seed phrase – back it up
              now!
            </div>

            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="font-bold cursor-pointer mx-auto my-4 px-4 py-2 bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.3)] rounded text-white text-sm"
            >
              Anyone with your seed phrase can access your wallet
              <div className="font-semibold my-1 text-amber-300 underline">
                {revealed ? "Hide seed phrase" : "Show seed phrase"}
              </div>
            </button>

            <div
              className={`mnemonic-phrase grid grid-cols-3 gap-[10px] p-[15px] w-full mb-[15px] transition-all duration-300 ease-linear ${
                revealed
                  ? "filter-none pointer-events-auto select-text"
                  : "filter blur-[8px] pointer-events-none select-none"
              }`}
            >
              {step.mnemonic!.phrase.split(" ").map((word, i) => (
                <span key={i} className="mnemonic-word">
                  <span className="word-number font-bold">{i + 1}.</span> {word}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!revealed}
              className="copy-button mx-auto mt-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copy Seed Phrase
            </button>
          </div>

          <button
            type="button"
            className="mx-auto mt-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded"
            onClick={() => {
              setStep({ type: "home", mnemonic: undefined });
              onStepChange("home");
            }}
          >
            Back to Wallets
          </button>
        </>
      )}

      {/* Import wallet 'Route' */}
      {step.type === "import" && (
        <>
          <h2 className="font-bold text-lg text-center">Import Wallet</h2>

          {/* Derivation Type Selection */}
          <div className="form-group">
            <label>Derivation Standard</label>
            <div className="flex flex-col gap-2 sm:gap-3 mt-2">
              <label className="radio-option">
                <input
                  type="radio"
                  name="derivationType"
                  value="standard"
                  checked={derivationType === "standard"}
                  onChange={(e) =>
                    setDerivationType(e.target.value as WalletDerivationType)
                  }
                />
                <span>Standard (Recommended)</span>
                <small>
                  Compatible with Kaspium and other standard wallets
                </small>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="derivationType"
                  value="legacy"
                  checked={derivationType === "legacy"}
                  onChange={(e) =>
                    setDerivationType(e.target.value as WalletDerivationType)
                  }
                />
                <span>Legacy</span>
                <small>For compatibility with older wallets</small>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Wallet Name</label>
            <input ref={nameRef} type="text" placeholder="My Wallet" />
          </div>
          <div className="form-group">
            <label>Seed Phrase Length</label>
            <div className="flex flex-col gap-2 sm:gap-3 mt-2">
              <label className="radio-option">
                <input
                  type="radio"
                  name="importSeedLength"
                  value="12"
                  checked={seedPhraseLength === 12}
                  onChange={() => setSeedPhraseLength(12)}
                />
                <span>12 words</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="importSeedLength"
                  value="24"
                  checked={seedPhraseLength === 24}
                  onChange={() => setSeedPhraseLength(24)}
                />
                <span>24 words</span>
              </label>
            </div>
            <MnemonicEntry
              seedPhraseLength={seedPhraseLength}
              mnemonicRef={mnemonicRef}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter password"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="flex flex-col gap-2 justify-center sm:flex-row-reverse sm:gap-4">
            <button
              onClick={onImportWallet}
              className="cursor-pointer w-full bg-[var(--accent-blue)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Create
            </button>
            <button
              onClick={() => onStepChange("home")}
              className="cursor-pointer w-full bg-[var(--primary-bg)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Back
            </button>
          </div>
        </>
      )}

      {/* import success continues from import without a new path */}
      {step.type === "success" && (
        <>
          <h2 className="font-bold text-lg text-center">Wallet Unlocked</h2>
          <div className="mt-5 flex justify-center">
            <button
              className="w-full bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer"
              onClick={() => onStepChange("home")}
            >
              Back to Wallets
            </button>
          </div>
        </>
      )}

      {/* Migrate wallet 'Route' */}
      {step.type === "migrate" && (
        <>
          <h2 className="font-bold text-lg text-center">
            Migrate Legacy Wallet
          </h2>
          <div className="migration-info">
            <p>
              Migrating wallet:{" "}
              <strong>
                {wallets.find((w) => w.id === step.walletId)?.name}
              </strong>
            </p>
            <p>
              This will create a new wallet using the standard Kaspa derivation
              path (m/44'/111111'/0') that is compatible with Kaspium and other
              standard wallets.
            </p>
            <div className="my-5 text-amber-300 p-4 text-center bg-[#1a1f2e] border border-[#2a3042] rounded-lg flex flex-col items-center">
              <ExclamationTriangleIcon className="w-5 h-5" /> Your original
              wallet will remain unchanged. You'll need to transfer funds to the
              new wallet addresses.
            </div>
          </div>

          <div className="form-group">
            <label>New Wallet Name</label>
            <input
              ref={nameRef}
              type="text"
              placeholder={`${
                wallets.find((w) => w.id === step.walletId)?.name
              } (Standard)`}
              defaultValue={`${
                wallets.find((w) => w.id === step.walletId)?.name
              } (Standard)`}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter your current wallet password"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="flex flex-col gap-2 justify-center sm:flex-row-reverse sm:gap-4">
            <button
              onClick={onMigrateWallet}
              className="cursor-pointer w-full bg-[var(--accent-blue)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Create
            </button>
            <button
              onClick={() => onStepChange("home")}
              className="cursor-pointer w-full bg-[var(--primary-bg)] text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200"
            >
              Back
            </button>
          </div>
        </>
      )}

      {/* Unlock wallet 'Route' */}
      {/* Unlock wallet 'Route' */}
      {step.type === "unlock" && (
        <>
          <h2 className="font-bold text-lg text-center">Unlock Wallet</h2>

          {wallets.find((w) => w.id === selectedWalletId) && (
            <div className="text-center mb-5 p-2.5 bg-[#2c3e50] rounded">
              <span className="font-semibold text-[var(--text-primary)]">
                {wallets.find((w) => w.id === selectedWalletId)?.name}
              </span>
            </div>
          )}

          {unlocking ? (
            <div className="relative my-2 flex flex-col items-center justify-center h-full space-y-4">
              <span className="text-sm sm:text-lg text-gray-300 font-medium tracking-wide">
                Unlocking Wallet…
              </span>
              <ArrowPathIcon className="my-2 w-14 h-14 text-gray-500 animate-spin" />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Password</label>
                <input
                  data-1p-ignore
                  data-lpignore="true"
                  data-protonpass-ignore="true"
                  autoComplete="off"
                  ref={usePasswordRef}
                  type="password"
                  placeholder="Enter your password"
                  className={error ? "error" : ""}
                  onKeyDown={(e) => e.key === "Enter" && onUnlockWallet()}
                  disabled={unlocking}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <div className="form-actions">
                <button
                  onClick={() => onStepChange("home")}
                  disabled={unlocking}
                >
                  Back
                </button>
                <button onClick={onUnlockWallet} disabled={unlocking}>
                  Unlock
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
