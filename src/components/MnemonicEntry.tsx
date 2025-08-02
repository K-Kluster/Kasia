import React, { useState, ClipboardEvent, ChangeEvent, useEffect } from "react";
import { Switch } from "@headlessui/react";
import clsx from "clsx";

interface MnemonicEntryProps {
  seedPhraseLength: number;
  mnemonicRef: React.RefObject<HTMLTextAreaElement | null>;
  passphraseRef?: React.RefObject<HTMLInputElement | null>;
}

export const MnemonicEntry = ({
  seedPhraseLength,
  mnemonicRef,
  passphraseRef,
}: MnemonicEntryProps) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // If the user changes the seed phrase length, reset the input fields
  useEffect(() => {
    if (mnemonicRef.current) mnemonicRef.current.value = "";
    if (passphraseRef?.current) passphraseRef.current.value = "";
    document
      .querySelectorAll<HTMLInputElement>(".mnemonic-input-grid input")
      .forEach((i) => (i.value = ""));
    setFocusedIndex(null);
  }, [seedPhraseLength, mnemonicRef, passphraseRef]);

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, idx: number) => {
    if (idx !== 0) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const words = pastedText.trim().split(/\s+/).slice(0, seedPhraseLength);

    const inputs = Array.from(
      (e.target as HTMLInputElement).parentElement?.querySelectorAll("input") ??
        []
    ) as HTMLInputElement[];

    words.forEach((word, i) => {
      if (inputs[i]) inputs[i].value = word;
    });
    if (mnemonicRef.current) mnemonicRef.current.value = words.join(" ");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target as HTMLInputElement;
    const allInputs = inputEl.parentElement?.querySelectorAll("input") ?? [];
    const words = Array.from(allInputs).map((inp) =>
      (inp as HTMLInputElement).value.trim()
    );
    if (mnemonicRef.current) mnemonicRef.current.value = words.join(" ");
  };

  return (
    <div>
      <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
        Mnemonic Phrase
      </label>
      <div className="mnemonic-input-grid mb-2 grid grid-cols-3 gap-2 md:grid-cols-6">
        {Array.from({ length: seedPhraseLength }, (_, i) => {
          const visible = focusedIndex === i;
          return (
            <input
              key={i}
              type={visible ? "text" : "password"}
              placeholder={`Word ${i + 1}`}
              className={clsx(
                "w-full rounded-xl p-2",
                "border-primary-border border bg-[var(--primary-bg)]",
                "text-[var(--text-primary)]",
                "focus:border-[var(--color-kas-secondary)] focus:outline-none",
                "placeholder:text-sm"
              )}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() => setFocusedIndex(null)}
              onPaste={(e) => handlePaste(e, i)}
              onChange={handleChange}
            />
          );
        })}
      </div>
      <textarea ref={mnemonicRef} readOnly className="hidden" />

      <div className="mt-4 mb-4">
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={showPassphrase}
            onChange={setShowPassphrase}
            className={clsx(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-[var(--color-kas-secondary)] focus:ring-offset-2 focus:outline-none",
              {
                "bg-[var(--color-kas-secondary)]": showPassphrase,
                "bg-[var(--primary-border)]": !showPassphrase,
              }
            )}
          >
            <span
              className={clsx(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                {
                  "translate-x-6": showPassphrase,
                  "translate-x-1": !showPassphrase,
                }
              )}
            />
          </Switch>
          <span className="text-[var(--text-primary)]">
            My wallet has a passphrase (BIP39)
          </span>
        </label>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          Check this box if your wallet was created with an additional
          passphrase for extra security.
        </p>
      </div>

      {showPassphrase && (
        <div className="mt-4 mb-4">
          <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
            Passphrase (Optional)
          </label>
          <input
            ref={passphraseRef}
            type="password"
            placeholder="Enter passphrase (leave empty if none)"
            className={clsx(
              "w-full rounded-xl p-2",
              "border-primary-border border bg-[var(--primary-bg)]",
              "text-[var(--text-primary)]",
              "focus:border-[var(--color-kas-secondary)] focus:outline-none",
              "placeholder:text-sm"
            )}
          />
          <p className="mt-3 text-xs text-[var(--text-secondary)]">
            A passphrase adds an extra layer of security to your wallet. Only
            enter one if your wallet was created with a passphrase.
          </p>
        </div>
      )}
    </div>
  );
};
