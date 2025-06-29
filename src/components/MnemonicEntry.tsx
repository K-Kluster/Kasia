import React, { useState, ClipboardEvent, ChangeEvent, useEffect } from "react";
import clsx from "clsx";

interface MnemonicEntryProps {
  seedPhraseLength: number;
  mnemonicRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const MnemonicEntry = ({
  seedPhraseLength,
  mnemonicRef,
}: MnemonicEntryProps) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // If the user changes the seed phrase length, reset the input fields
  useEffect(() => {
    if (mnemonicRef.current) mnemonicRef.current.value = "";
    document
      .querySelectorAll<HTMLInputElement>(".mnemonic-input-grid input")
      .forEach((i) => (i.value = ""));
    setFocusedIndex(null);
  }, [seedPhraseLength]);

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
      <label className="mb-1 block font-medium text-[var(--text-primary)]">
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
                "w-full rounded p-2",
                "border border-[var(--border-color)] bg-[var(--primary-bg)]",
                "text-[var(--text-primary)]",
                "focus:border-[var(--accent-blue)] focus:outline-none",
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
    </div>
  );
};
