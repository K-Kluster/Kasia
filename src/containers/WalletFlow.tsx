import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { Radio, RadioGroup, Label } from "@headlessui/react";
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
import { Button } from "../components/Common/Button";
import { useIsMobile } from "../utils/useIsMobile";

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

  const [error, setError] = useState<{ message: string; id: number } | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24); // Default to 24 words
  const [derivationType, setDerivationType] =
    useState<WalletDerivationType>("standard");
  const [revealed, setRevealed] = useState(false);

  const [unlocking, setUnlocking] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mnemonicRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const isMobile = useIsMobile();

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

  useEffect(() => {
    if (!error) return;
    toast.error(error.message);
  }, [error]);

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
        console.log("Navigated to Messaging container");
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
      setError({ message: "Please enter a name and password", id: Date.now() });
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
        setError({
          message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
          id: Date.now(),
        });
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
      setError({
        message: err instanceof Error ? err.message : "Failed to create wallet",
        id: Date.now(),
      });
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
      setError({ message: "Please enter all fields", id: Date.now() });
      return;
    }
    const pw = passwordRef.current!.value;
    if (!disablePasswordRequirements && pw.length < PASSWORD_MIN_LENGTH) {
      setError({
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
        id: Date.now(),
      });
      return;
    }
    try {
      const mnemonic = new Mnemonic(mnemonicRef.current.value);
      await createWallet(nameRef.current.value, mnemonic, pw, derivationType);
      setStep({ type: "success" });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Invalid mnemonic",
        id: Date.now(),
      });
    } finally {
      if (mnemonicRef.current.value) mnemonicRef.current.value = "";
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  const onUnlockWallet = async () => {
    const pass = passwordRef.current?.value;
    if (!selectedWalletId || !pass) {
      setError({
        message: "Please enter your wallet password",
        id: Date.now(),
      });
      return;
    }
    setError(null);
    try {
      setUnlocking(true);
      await unlock(selectedWalletId, pass);
      onStepChange("unlocked", selectedWalletId);
    } catch (err) {
      console.error("Unlock error:", err);
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
      const msg =
        err instanceof Error &&
        err.message.toLowerCase().includes("invalid password")
          ? "Incorrect password. Please try again."
          : "Failed to unlock wallet. Please try again.";
      setError({ message: msg, id: Date.now() });
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
      setError({ message: "Please enter all required fields", id: Date.now() });
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
      setError({
        message:
          err instanceof Error ? err.message : "Failed to migrate wallet",
        id: Date.now(),
      });
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
      <span className="bg-kas-primary rounded px-2 py-1 text-xs font-medium text-white">
        Standard (Kaspium Compatible)
      </span>
    ) : (
      <span className="rounded bg-amber-400 px-2 py-1 text-xs font-medium text-white">
        Legacy
      </span>
    );

  const wrapperClass = clsx(
    "w-full bg-[var(--secondary-bg)] p-8",
    isMobile
      ? clsx(
          "fixed inset-0 w-full max-h-screen overflow-y-auto flex flex-col",
          step.type === "home"
            ? wallets.length > 2
              ? "justify-start"
              : "justify-center"
            : "justify-start"
        )
      : "mx-auto my-8 rounded-lg max-w-[600px] border border-[var(--border-color)]",
    { relative: step.type === "home" && !isMobile }
  );

  return (
    <div className={wrapperClass}>
      {/* Home wallet 'Route' */}
      {step.type === "home" && (
        <>
          <Link to="/settings-network">
            <Cog6ToothIcon className="absolute top-4 right-4 size-6 hover:cursor-pointer hover:opacity-80" />
          </Link>
          <div
            className={clsx(
              "mb-1 flex items-center justify-center",
              isMobile ? "grow-0" : "grow"
            )}
          >
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
            />
          </div>
          <TrustMessage />
          <h2 className="mt-2 mb-2 text-center text-xl font-semibold text-[var(--text-primary)] sm:mt-2 sm:mb-3 sm:text-2xl">
            {wallets.length <= 0 ? "No Wallets Found" : "Select Wallet"}
          </h2>
          <div className="mb-3 flex flex-col gap-2 sm:gap-4">
            {wallets.map((w) => (
              <div
                key={w.id}
                onClick={() => onSelectWallet(w)}
                className="hover:border-kas-secondary/50 relative flex cursor-pointer flex-col items-start gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--primary-bg)] p-4 hover:bg-slate-900/20 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* delete icon top-right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWallet(w.id);
                  }}
                  className="absolute top-2 right-2 cursor-pointer p-1 text-red-400 hover:text-red-700"
                  title="Delete"
                >
                  <TrashIcon className="h-6 w-6" />
                </button>

                <div className="flex flex-col gap-1">
                  <div className="inline-flex items-center space-x-1 font-semibold text-[var(--text-primary)]">
                    <span>{w.name}</span>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] sm:text-sm">
                    Created: {new Date(w.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {getDerivationTypeDisplay(w.derivationType)}
                    {w.derivationType === "legacy" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStepChange("migrate", w.id);
                        }}
                        className="animate-pulse cursor-pointer rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors duration-200 hover:bg-blue-600"
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

          <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
            <Button variant="primary" onClick={() => onStepChange("create")}>
              Create New Wallet
            </Button>
            <Button variant="secondary" onClick={() => onStepChange("import")}>
              Import Wallet
            </Button>
          </div>
        </>
      )}

      {/* Create wallet 'Route' */}
      {step.type === "create" && (
        <>
          <h2 className="mb-1 text-center text-lg font-bold">
            Create New Wallet
          </h2>

          <RadioGroup
            name="derivationType"
            value={derivationType}
            onChange={setDerivationType}
            className="mb-2 sm:mb-3"
          >
            <Label className="mb-3 block text-base font-semibold text-white">
              Derivation Standard
            </Label>
            <div className="flex flex-col gap-2 sm:gap-3">
              {[
                {
                  value: "standard",
                  label: "Standard (Recommended)",
                  description:
                    "Compatible with Kaspium and other standard wallets",
                },
                {
                  value: "legacy",
                  label: "Legacy",
                  description: "For compatibility with older wallets",
                },
              ].map((opt) => (
                <Radio
                  key={opt.value}
                  as="label"
                  value={opt.value}
                  className="group hover:border-kas-secondary/50 flex cursor-pointer flex-col items-start gap-y-1 rounded-md border border-[var(--border-color)] bg-slate-900 p-3 transition-colors duration-200 hover:bg-slate-900/20 data-checked:border-[var(--color-kas-primary)] data-checked:bg-[var(--color-kas-primary)]/5"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                    {opt.label}
                  </span>
                  <small className="text-xs text-[var(--text-secondary)] group-data-checked:text-[var(--color-kas-primary)] sm:text-sm">
                    {opt.description}
                  </small>
                </Radio>
              ))}
            </div>
          </RadioGroup>

          <div className="mb-3">
            <label className="mb-3 block text-base font-semibold text-white">
              Wallet Name
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder="My Wallet"
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <RadioGroup
            name="seedLength"
            value={seedPhraseLength}
            onChange={setSeedPhraseLength}
            className="mb-3"
          >
            <Label className="mb-3 block text-base font-semibold text-white">
              Seed Phrase Length
            </Label>
            <div className="flex flex-col gap-2 sm:gap-3">
              {[
                {
                  value: 24,
                  label: "24 words (Recommended)",
                  description: "256-bit entropy",
                },
                {
                  value: 12,
                  label: "12 words",
                  description: "128-bit entropy",
                },
              ].map((opt) => (
                <Radio
                  key={opt.value}
                  as="label"
                  value={opt.value}
                  className="group hover:border-kas-secondary/50 flex cursor-pointer flex-col items-start gap-y-1 rounded-md border border-[var(--border-color)] bg-slate-900 p-3 transition-colors duration-200 hover:bg-slate-900/20 data-checked:border-[var(--color-kas-primary)] data-checked:bg-[var(--color-kas-primary)]/5"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                    {opt.label}
                  </span>
                  <small className="text-xs text-[var(--text-secondary)] group-data-checked:text-[var(--color-kas-primary)] sm:text-sm">
                    {opt.description}
                  </small>
                </Radio>
              ))}
            </div>
          </RadioGroup>

          <div className="mb-3">
            <label className="mb-3 block text-base font-semibold text-white">
              Password
            </label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter password"
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
            <Button onClick={onCreateWallet} variant="primary">
              Create
            </Button>
            <Button onClick={() => onStepChange("home")} variant="secondary">
              Back
            </Button>
          </div>
        </>
      )}

      {/* Seed continues from Create without a new path */}
      {step.type === "seed" && step.mnemonic && (
        <>
          <h2 className="text-center text-lg font-bold">Wallet Created</h2>
          <div className="my-5 flex w-full flex-col items-center rounded-lg border border-[#2a3042] bg-[#1a1f2e] px-4 py-4">
            <p className="font-semibold">
              Please save your mnemonic phrase securely:
            </p>
            <div className="my-2 flex flex-col items-center rounded-lg p-2 text-center text-base text-amber-300">
              <ExclamationTriangleIcon className="h-8 w-8" />
              Please keep your seed phrase safe, if you lose your seed phrase
              there is no recovery.
            </div>

            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="bg-kas-primary/20 mx-auto my-4 cursor-pointer rounded border border-[rgba(76,175,80,0.3)] px-4 py-2 text-sm font-bold text-white"
            >
              Anyone with your seed phrase can access your wallet
              <div className="my-1 font-semibold text-amber-300 underline">
                {revealed ? "Hide seed phrase" : "Show seed phrase"}
              </div>
            </button>

            <div
              className={`mb-3.5 grid w-full grid-cols-3 gap-2.5 p-2 transition-all duration-300 ease-linear ${
                revealed
                  ? "pointer-events-auto filter-none select-text"
                  : "pointer-events-none blur-[8px] filter select-none"
              }`}
            >
              {step.mnemonic!.phrase.split(" ").map((word, i) => (
                <span
                  key={i}
                  className="text-kas-secondary flex flex-col items-center rounded bg-gray-800 p-2 font-mono text-sm sm:text-base"
                >
                  <span className="text-text-secondary text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="w-full text-center">{word}</span>
                </span>
              ))}
            </div>

            <Button
              type="button"
              onClick={handleCopy}
              disabled={!revealed}
              variant="primary"
              className="mx-auto mt-2 px-4 py-2 text-sm disabled:cursor-not-allowed"
            >
              Copy Seed Phrase
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => {
              setStep({ type: "home", mnemonic: undefined });
              onStepChange("home");
            }}
            variant="secondary"
            className="mx-auto px-4 py-2 text-sm"
          >
            Back to Wallets
          </Button>
        </>
      )}

      {/* Import wallet 'Route' */}
      {step.type === "import" && (
        <>
          <h2 className="text-center text-lg font-bold">Import Wallet</h2>

          <RadioGroup
            name="derivationType"
            value={derivationType}
            onChange={setDerivationType}
            className="mb-3"
          >
            <Label className="mb-3 block text-base font-semibold text-white">
              Derivation Standard
            </Label>

            <div className="flex flex-col gap-2 sm:gap-3">
              {[
                {
                  value: "standard",
                  label: "Standard (Recommended)",
                  description:
                    "Compatible with Kaspium and other standard wallets",
                },
                {
                  value: "legacy",
                  label: "Legacy",
                  description: "For compatibility with older wallets",
                },
              ].map((opt) => (
                <Radio
                  key={opt.value}
                  as="label"
                  value={opt.value}
                  className="group hover:border-kas-secondary/50 flex cursor-pointer flex-col items-start gap-y-1 rounded-md border border-[var(--border-color)] bg-slate-900 p-3 transition-colors duration-200 hover:bg-slate-900/20 data-checked:border-[var(--color-kas-primary)] data-checked:bg-[var(--color-kas-primary)]/5"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                    {opt.label}
                  </span>
                  <small className="text-xs text-[var(--text-secondary)] group-data-checked:text-[var(--color-kas-primary)] sm:text-sm">
                    {opt.description}
                  </small>
                </Radio>
              ))}
            </div>
          </RadioGroup>

          <div className="mb-3">
            <label className="mb-3 block text-base font-semibold text-white">
              Wallet Name
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder="My Wallet"
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <RadioGroup
            name="importSeedLength"
            value={seedPhraseLength.toString() as "12" | "24"}
            onChange={(val) => setSeedPhraseLength(val === "24" ? 24 : 12)}
            className="mb-2 sm:mb-3"
          >
            <Label className="mb-3 block text-base font-semibold text-white">
              Seed Phrase Length
            </Label>
            <div className="flex flex-col gap-2 sm:gap-3">
              {["24", "12"].map((val) => (
                <Radio
                  key={val}
                  as="label"
                  value={val}
                  className="group hover:border-kas-secondary/50 flex cursor-pointer flex-col items-start gap-y-1 rounded-md border border-[var(--border-color)] bg-slate-900 p-3 transition-colors duration-200 hover:bg-slate-900/20 data-checked:border-[var(--color-kas-primary)] data-checked:bg-[var(--color-kas-primary)]/5"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                    {val} words
                  </span>
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <MnemonicEntry
            seedPhraseLength={seedPhraseLength}
            mnemonicRef={mnemonicRef}
          />

          <div className="mb-3">
            <label className="mb-3 block text-base font-semibold text-white">
              Password
            </label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter password"
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
            <Button onClick={onImportWallet} variant="primary">
              Create
            </Button>
            <Button onClick={() => onStepChange("home")} variant="secondary">
              Back
            </Button>
          </div>
        </>
      )}

      {/* import success continues from import without a new path */}
      {step.type === "success" && (
        <>
          <h2 className="text-center text-lg font-bold">Wallet Unlocked</h2>
          <div className="mt-5 flex justify-center">
            <Button
              onClick={() => onStepChange("home")}
              variant="primary"
              className="w-full px-4 py-2 text-sm"
            >
              Back to Wallets
            </Button>
          </div>
        </>
      )}

      {/* Migrate wallet 'Route' */}
      {step.type === "migrate" && (
        <>
          <h2 className="mb-1 text-center text-lg font-bold sm:mb-3">
            Migrate Legacy Wallet
          </h2>
          <div className="mb-4 rounded-lg border border-[var(--border-color)] bg-[var(--primary-bg)] p-4">
            <p className="mb-2 font-semibold text-[var(--text-primary)]">
              Migrating wallet:{" "}
              <strong className="text-[var(--accent-blue)]">
                {wallets.find((w) => w.id === step.walletId)?.name}
              </strong>
            </p>
            <p className="my-2 text-[var(--text-secondary)]">
              This will create a new wallet using the standard Kaspa derivation
              path (m/44'/111111'/0') that is compatible with Kaspium and other
              standard wallets.
            </p>
            <div className="mt-5 mb-1 flex flex-col items-center rounded-lg border border-[#2a3042] bg-[#1a1f2e] p-4 text-center text-amber-300">
              <ExclamationTriangleIcon className="h-5 w-5" /> Your original
              wallet will remain unchanged. You'll need to transfer funds to the
              new wallet addresses.
            </div>
          </div>

          <div className="mb-2 sm:mb-3">
            <label className="mb-1 block text-base font-semibold text-white sm:mb-3">
              New Wallet Name
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder={`${wallets.find((w) => w.id === step.walletId)?.name} (Standard)`}
              defaultValue={`${wallets.find((w) => w.id === step.walletId)?.name} (Standard)`}
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="mb-3 block text-base font-semibold text-white">
              Password
            </label>
            <input
              ref={passwordRef}
              type="password"
              placeholder="Enter your current wallet password"
              className="focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
            <Button onClick={onMigrateWallet} variant="primary">
              Create
            </Button>
            <Button onClick={() => onStepChange("home")} variant="secondary">
              Back
            </Button>
          </div>
        </>
      )}

      {/* Unlock wallet 'Route' */}
      {step.type === "unlock" && (
        <>
          <div inert className="mb-4 flex w-full justify-center opacity-70">
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
            />
          </div>
          <h2 className="text-center text-lg font-bold">Unlock Wallet</h2>

          {wallets.find((w) => w.id === selectedWalletId) && (
            <div className="mb-5 rounded bg-[#2c3e50] p-2.5 text-center">
              <span className="font-semibold text-[var(--text-primary)]">
                {wallets.find((w) => w.id === selectedWalletId)?.name}
              </span>
            </div>
          )}

          {unlocking ? (
            <div className="relative my-2 flex h-full flex-col items-center justify-center space-y-4">
              <span className="text-sm font-medium tracking-wide text-gray-300 sm:text-lg">
                Unlocking Wallet…
              </span>
              <ArrowPathIcon className="my-2 h-14 w-14 animate-spin text-gray-500" />
            </div>
          ) : (
            <>
              <div className="mb-3.5">
                <label className="mb-3.5 block font-medium text-white">
                  Password
                </label>
                <input
                  data-1p-ignore
                  data-lpignore="true"
                  data-protonpass-ignore="true"
                  autoComplete="off"
                  ref={usePasswordRef}
                  type="password"
                  placeholder="Enter your password"
                  className={clsx(
                    "focus:!border-kas-primary w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none",
                    { "!border-red-500": error }
                  )}
                  onKeyDown={(e) => e.key === "Enter" && onUnlockWallet()}
                  disabled={unlocking}
                />
              </div>

              <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
                <Button
                  onClick={onUnlockWallet}
                  disabled={unlocking || !isConnected}
                  variant="primary"
                  title={
                    !isConnected ? "Waiting for network connection…" : undefined
                  }
                >
                  Unlock
                </Button>

                <Button
                  onClick={() => onStepChange("home")}
                  disabled={unlocking}
                  variant="secondary"
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
