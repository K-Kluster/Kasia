import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { Mnemonic } from "kaspa-wasm";

type WalletStep =
  | {
      type: "home";
    }
  | {
      type: "create";
      password?: string;
    }
  | {
      type: "import";
      mnemonic?: string;
      password?: string;
    }
  | {
      type: "unlock";
      password?: string;
    }
  | {
      type: "finalizing";
      mnemonic?: string;
    };

export const WalletGuard: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const doesExists = useWalletStore((s) => s.doesExists);
  const unlockedWallet = useWalletStore((s) => s.unlockedWallet);
  const walletStore = useWalletStore();

  const passwordRef = useRef<HTMLInputElement | null>(null);
  const mnemonicRef = useRef<HTMLTextAreaElement | null>(null);

  const [step, setStep] = useState<WalletStep>({ type: "home" });
  const [error, setError] = useState<string | null>(null);

  // on mounted, if wallet is already unlocked, just skip the step
  useEffect(() => {
    if (unlockedWallet !== null) {
      onSuccess();
    }
  }, []);

  const onClickStep = useCallback((step: "create" | "import" | "unlock") => {
    setStep({ type: step });
  }, []);

  const onCreateWallet = useCallback(async () => {
    if (!passwordRef.current) return;

    const password = passwordRef.current.value;

    if (!password) {
      setError("Password is required");
      return;
    }

    const mnemonic = Mnemonic.random(24);

    await walletStore.create(mnemonic, password);

    setStep({ type: "finalizing", mnemonic: mnemonic.phrase });
  }, [walletStore]);

  const onImportWallet = useCallback(async () => {
    if (!passwordRef.current) return;

    const password = passwordRef.current.value;

    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      const mnemonic = new Mnemonic(mnemonicRef.current?.value || "");

      await walletStore.create(mnemonic, password);

      setStep({ type: "finalizing" });
    } catch {
      setError("Invalid mnemonic");
    }
  }, [walletStore]);

  const onUnlockWallet = useCallback(async () => {
    if (!passwordRef.current) return;

    const password = passwordRef.current.value;

    if (!password) {
      setError("Password is required");
    }

    try {
      await walletStore.unlock(password);

      onSuccess();
    } catch {
      setError("Invalid password");
    }
  }, [onSuccess, walletStore]);

  if (step.type === "home") {
    return (
      <>
        {!doesExists ? (
          <>
            <button onClick={() => onClickStep("create")}>Create Wallet</button>
            <button onClick={() => onClickStep("import")}>Import Wallet</button>
          </>
        ) : unlockedWallet === null ? (
          <button onClick={() => onClickStep("unlock")}>Unlock Wallet</button>
        ) : null}
      </>
    );
  }

  if (step.type === "create") {
    return (
      <>
        <input ref={passwordRef} type="password" required />
        <button onClick={onCreateWallet}>Use This Password</button>
        <p>{error}</p>
      </>
    );
  }

  if (step.type === "import") {
    return (
      <>
        <textarea ref={mnemonicRef} required />
        <button onClick={onImportWallet}>Confirm Password</button>
        <p>{error}</p>
      </>
    );
  }

  if (step.type === "unlock") {
    return (
      <>
        <input ref={passwordRef} type="password" required />
        <button onClick={onUnlockWallet}>Unlock</button>
        <p>{error}</p>
      </>
    );
  }

  if (step.type === "finalizing") {
    <>
      {step.mnemonic ? (
        <p>
          Wallet created, please store the mnemonic safely:{" "}
          <code>{step.mnemonic}</code>
        </p>
      ) : (
        <p>Wallet imported successfully.</p>
      )}
      <button onClick={onSuccess}>I'm ready</button>
    </>;
  }
};
