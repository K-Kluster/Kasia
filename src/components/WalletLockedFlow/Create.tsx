import { useRef, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { Radio, RadioGroup, Label } from "@headlessui/react";
import { WalletDerivationType } from "../../types/wallet.type";
import {
  PASSWORD_MIN_LENGTH,
  disablePasswordRequirements,
} from "../../config/password";
import { Button } from "../Common/Button";
import { WalletFlowErrorMessage } from "./WalletFlowErrorMessage";

type CreateWalletProps = {
  onSuccess: (walletId: string, mnemonic: Mnemonic) => void;
  onBack: () => void;
};

export const CreateWallet = ({ onSuccess, onBack }: CreateWalletProps) => {
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24);
  const [derivationType, setDerivationType] =
    useState<WalletDerivationType>("standard");
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const { createWallet } = useWalletStore();

  const onCreateWallet = async () => {
    if (!nameRef.current?.value || !passwordRef.current?.value) {
      setError("Please enter a name and password");
      return;
    }
    try {
      // Generate mnemonic with specified word count
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
      onSuccess(id, mnemonic);
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  return (
    <>
      <h2 className="mb-3 text-center text-lg font-bold">Create New Wallet</h2>

      <RadioGroup
        name="derivationType"
        value={derivationType}
        onChange={setDerivationType}
        className="mb-2 sm:mb-3"
      >
        <Label className="mb-3 block text-base font-semibold">
          Derivation Standard
        </Label>
        <div className="flex flex-col gap-2 sm:gap-3">
          {[
            {
              value: "standard",
              label: "Standard (Recommended)",
              description: "Compatible with Kaspium and other standard wallets",
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
              className="group border-primary-border flex cursor-pointer flex-col items-start gap-y-1 rounded-md border bg-[var(--primary-bg)] p-3 transition-colors duration-200 hover:bg-[var(--primary-bg)]/50 data-checked:border-[var(--color-kas-secondary)] data-checked:bg-[var(--color-kas-secondary)]/5"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                {opt.label}
              </span>
              <small className="text-xs text-[var(--text-secondary)] group-data-checked:text-[var(--color-kas-primary)] sm:text-sm">
                {opt.description}
              </small>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <div className="my-1">
        <label className="mb-3 block text-base font-semibold">
          Wallet Name
        </label>
        <input
          ref={nameRef}
          type="text"
          placeholder="My Wallet"
          onChange={handleInputChange}
          className="border-primary-border w-full rounded-3xl border bg-[var(--input-bg)] p-2.5 px-4 text-base transition-all duration-200 focus:!border-[var(--color-kas-secondary)] focus:outline-none"
        />
      </div>

      <RadioGroup
        name="seedLength"
        value={seedPhraseLength}
        onChange={setSeedPhraseLength}
        className="my-1"
      >
        <Label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
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
              className="group border-primary-border flex cursor-pointer flex-col items-start gap-y-1 rounded-md border bg-[var(--primary-bg)] p-3 transition-colors duration-200 hover:bg-[var(--primary-bg)]/50 data-checked:border-[var(--color-kas-secondary)] data-checked:bg-[var(--color-kas-secondary)]/5"
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

      <div className="mt-1 mb-6">
        <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
          Password
        </label>
        <input
          autoComplete="new-password"
          ref={passwordRef}
          type="password"
          placeholder="Enter password"
          onChange={handleInputChange}
          className="border-primary-border w-full rounded-3xl border bg-[var(--input-bg)] p-2.5 px-4 text-base transition-all duration-200 focus:!border-[var(--color-kas-secondary)] focus:outline-none"
        />
      </div>

      {error && <WalletFlowErrorMessage message={error} />}

      <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
        <Button onClick={onCreateWallet} variant="primary">
          Create
        </Button>
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
      </div>
    </>
  );
};
