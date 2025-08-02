import { useRef, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { Radio, RadioGroup, Label } from "@headlessui/react";
import { WalletDerivationType } from "../../types/wallet.type";
import {
  PASSWORD_MIN_LENGTH,
  disablePasswordRequirements,
} from "../../config/password";
import { MnemonicEntry } from "../MnemonicEntry";
import { Button } from "../Common/Button";

type ImportWalletProps = {
  onSuccess: () => void;
  onBack: () => void;
};

export const Import = ({ onSuccess, onBack }: ImportWalletProps) => {
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24);
  const [derivationType, setDerivationType] =
    useState<WalletDerivationType>("standard");
  const [mnemonicValue, setMnemonicValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const { createWallet } = useWalletStore();

  const onImportWallet = async () => {
    if (
      !nameRef.current?.value ||
      !mnemonicValue ||
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
      const mnemonic = new Mnemonic(mnemonicValue);
      await createWallet(nameRef.current.value, mnemonic, pw, derivationType);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid mnemonic");
    } finally {
      setMnemonicValue("");
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  return (
    <>
      <h2 className="text-center text-lg font-bold">Import Wallet</h2>

      <RadioGroup
        name="derivationType"
        value={derivationType}
        onChange={setDerivationType}
        className="mb-3"
      >
        <Label className="my-3 block text-base font-semibold text-[var(--text-primary)]">
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
              className="group hover:border-kas-secondary/50 border-primary-border flex cursor-pointer flex-col items-start gap-y-1 rounded-2xl border bg-[var(--primary-bg)] p-3 transition-colors duration-200 hover:bg-[var(--primary-bg)]/50 data-checked:border-[var(--color-kas-secondary)] data-checked:bg-[var(--color-kas-secondary)]/5"
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

      <div className="mb-3">
        <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
          Wallet Name
        </label>
        <input
          ref={nameRef}
          type="text"
          placeholder="My Wallet"
          onChange={handleInputChange}
          className="focus:!border-kas-primary border-primary-border w-full rounded-3xl border bg-[var(--input-bg)] p-2.5 px-4 text-base transition-all duration-200 focus:outline-none"
        />
      </div>

      <RadioGroup
        name="importSeedLength"
        value={seedPhraseLength.toString() as "12" | "24"}
        onChange={(val) => setSeedPhraseLength(val === "24" ? 24 : 12)}
        className="mb-2 sm:mb-3"
      >
        <Label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
          Seed Phrase Length
        </Label>
        <div className="flex flex-col gap-2 sm:gap-3">
          {["24", "12"].map((val) => (
            <Radio
              key={val}
              as="label"
              value={val}
              className="group hover:border-kas-secondary/50 border-primary-border flex cursor-pointer flex-col items-start gap-y-1 rounded-2xl border bg-[var(--primary-bg)] p-3 transition-colors duration-200 hover:bg-[var(--primary-bg)]/50 data-checked:border-[var(--color-kas-secondary)] data-checked:bg-[var(--color-kas-secondary)]/5"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)] sm:text-base">
                {val} words
              </span>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <MnemonicEntry
        seedPhraseLength={seedPhraseLength}
        onMnemonicChange={setMnemonicValue}
      />

      <div className="mb-6">
        <label className="mb-3 block text-base font-semibold">Password</label>
        <input
          ref={passwordRef}
          type="password"
          placeholder="Enter password"
          onChange={handleInputChange}
          className="border-primary-border w-full rounded-3xl border bg-[var(--input-bg)] p-2.5 px-4 text-base transition-all duration-200 focus:!border-[var(--color-kas-secondary)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
        <Button onClick={onImportWallet} variant="primary">
          Create
        </Button>
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
      </div>
    </>
  );
};
