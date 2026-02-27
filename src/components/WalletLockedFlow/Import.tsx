import { useRef, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";
import { Radio, RadioGroup, Label } from "@headlessui/react";
import {
  PASSWORD_MIN_LENGTH,
  disablePasswordRequirements,
} from "../../config/password";
import { MnemonicEntry } from "../MnemonicEntry";
import { Button } from "../Common/Button";
import { WalletFlowErrorMessage } from "./WalletFlowErrorMessage";
import { PasswordField } from "../Common/PasswordField";
import { WarningBlock } from "../Common/WarningBlock";

type ImportWalletProps = {
  onSuccess: () => void;
  onBack: () => void;
};

export const Import = ({ onSuccess, onBack }: ImportWalletProps) => {
  const [seedPhraseLength, setSeedPhraseLength] = useState<12 | 24>(24);
  const [mnemonicValue, setMnemonicValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passphraseRef = useRef<HTMLInputElement>(null);

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
      setError(`Password must have at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    try {
      const mnemonic = new Mnemonic(mnemonicValue);
      const passphrase = passphraseRef.current?.value || undefined;
      await createWallet(nameRef.current.value, mnemonic, pw, passphrase);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid mnemonic");
    } finally {
      setMnemonicValue("");
      if (passphraseRef.current?.value) passphraseRef.current.value = "";
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  return (
    <>
      <h2 className="text-center text-lg font-bold">Import Account</h2>
      <WarningBlock
        title={"Import at your own risk"}
        children={
          "For security reasons, ideally create a new account and transfer a small amount of funds. Import an existing kaspa wallet only if absolutely necessary and only when it holds a low balance."
        }
        className="my-2 py-2!"
      />
      <div className="mb-3">
        <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
          Account Name
        </label>
        <input
          ref={nameRef}
          type="text"
          placeholder="My Account"
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
              className="group hover:border-kas-secondary/50 border-primary-border flex cursor-pointer flex-col items-start gap-y-1 rounded-2xl border bg-[var(--primary-bg)] p-3 transition-all duration-200 hover:bg-[var(--primary-bg)]/50 active:rounded-4xl data-checked:border-[var(--color-kas-secondary)] data-checked:bg-[var(--color-kas-secondary)]/5"
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
        passphraseRef={passphraseRef}
      />

      <div className="mb-6">
        <PasswordField
          label="Password"
          classLabel="mb-3 block text-base font-semibold"
          classInput="border-primary-border w-full rounded-3xl border bg-[var(--input-bg)] p-2.5 px-4 text-base transition-all duration-200 focus:!border-[var(--color-kas-secondary)] focus:outline-none"
          placeholder="Enter password"
          onChange={handleInputChange}
          ref={passwordRef}
        />
      </div>

      {error && <WalletFlowErrorMessage message={error} />}

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
