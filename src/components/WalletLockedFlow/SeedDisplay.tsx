import { useState } from "react";
import { Mnemonic } from "kaspa-wasm";
import { AlertTriangle } from "lucide-react";
import { Button } from "../Common/Button";
import { StringCopy } from "../Common/StringCopy";

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
      <h2 className="text-center text-lg font-bold">Wallet Created</h2>
      <div className="border-primary-border my-5 flex w-full flex-col items-center rounded-2xl border bg-[var(--primary-bg)] px-4 py-4">
        <p className="font-semibold">
          Please save your mnemonic phrase securely:
        </p>
        <div className="text-text-warning my-2 flex flex-col items-center rounded-2xl p-2 text-center text-base">
          <AlertTriangle className="h-8 w-8" />
          Please keep your seed phrase safe, if you lose your seed phrase there
          is no recovery.
        </div>

        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="bg-kas-primary/20 border-primary-border mx-auto my-4 cursor-pointer rounded-2xl border px-4 py-2 text-sm font-bold"
        >
          Anyone with your seed phrase can access your wallet
          <div className="text-text-warning my-1 font-semibold underline">
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
          {mnemonic.phrase.split(" ").map((word, i) => (
            <span
              key={i}
              className="text-kas-secondary flex flex-col items-center rounded bg-[var(--secondary-bg)] p-2 font-mono text-sm sm:text-base"
            >
              <span className="text-text-secondary text-xs font-bold">
                {i + 1}
              </span>
              <span className="w-full text-center">{word}</span>
            </span>
          ))}
        </div>

        <div className="flex justify-center">
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
        Back to Wallets
      </Button>
    </>
  );
};
