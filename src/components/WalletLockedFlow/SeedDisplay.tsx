import { useState } from "react";
import { Mnemonic } from "kaspa-wasm";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../Common/Button";
import { StringCopy } from "../Common/StringCopy";
import { WarningBlock } from "../Common/WarningBlock";

type SeedPhraseDisplayProps = {
  mnemonic: Mnemonic;
  onBack: () => void;
};

export const SeedPhraseDisplay = ({
  mnemonic,
  onBack,
}: SeedPhraseDisplayProps) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <h2 className="text-center text-lg font-bold">Account Created</h2>
      <div className="border-primary-border my-5 flex w-full flex-col items-center rounded-2xl border bg-[var(--primary-bg)] px-4 py-4">
        <p className="font-semibold">
          Please save your mnemonic phrase securely:
        </p>
        <WarningBlock title="Important" className="my-1.5 sm:w-11/12">
          Please keep your seed phrase safe, if you lose your seed phrase there
          is no recovery.
          <br />
          Remember: Anyone with your seed phrase can access your account and
          messages.
        </WarningBlock>
        <div
          className={`mb-3.5 grid w-full grid-cols-3 gap-2.5 p-2 transition-all duration-300 ease-linear ${
            revealed
              ? "pointer-events-auto filter-none select-text"
              : "pointer-events-none blur-[8px] filter select-none"
          }`}
        >
          {mnemonic.phrase.split(" ").map((word, i) => (
            <span
              key={i}
              className="text-kas-secondary flex flex-col items-center rounded bg-[var(--secondary-bg)] p-2 font-mono text-sm sm:text-base"
            >
              <span className="text-text-secondary text-xs font-bold">
                {i + 1}
              </span>
              <span className="w-full text-center font-semibold">{word}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          <input
            type="checkbox"
            id="toggleSeedVisibility"
            checked={revealed}
            onChange={(e) => setRevealed(e.target.checked)}
            className="hidden"
          />
          <label
            htmlFor="toggleSeedVisibility"
            className="focus:ring-kas-secondary flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm transition-all duration-300 hover:bg-gray-200/20 focus:ring-2 focus:outline-none"
            title={revealed ? "Hide seed phrase" : "Show seed phrase"}
          >
            {revealed ? (
              <EyeOff className="text-text-primary hover:text-kas-secondary size-8 align-middle transition-colors duration-300" />
            ) : (
              <Eye className="text-text-primary hover:text-kas-secondary size-8 align-middle transition-colors duration-300" />
            )}
          </label>
          <StringCopy
            text={mnemonic.phrase}
            alertText="Seed phrase copied"
            titleText="Copy seed phrase"
            className="px-4 py-2 text-sm"
            iconClass="size-8"
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={onBack}
        variant="secondary"
        className="mx-auto px-4 py-2 text-sm"
      >
        Back to Accounts
      </Button>
    </>
  );
};
