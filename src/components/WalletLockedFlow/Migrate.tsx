import { useRef, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { AlertTriangle } from "lucide-react";
import { Button } from "../Common/Button";
import { Wallet } from "../../types/wallet.type";
import { WalletFlowErrorMessage } from "./WalletFlowErrorMessage";

type MigrateWalletProps = {
  walletId: string | undefined;
  wallets: Wallet[];
  onSuccess: () => void;
  onBack: () => void;
};

export const Migrate = ({
  walletId,
  wallets,
  onSuccess,
  onBack,
}: MigrateWalletProps) => {
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const { migrateLegacyWallet } = useWalletStore();

  const onMigrateWallet = async () => {
    if (!walletId || !passwordRef.current?.value || !nameRef.current?.value) {
      setError("Please enter all required fields");
      return;
    }
    try {
      await migrateLegacyWallet(
        walletId,
        passwordRef.current!.value,
        nameRef.current!.value
      );
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to migrate wallet");
    } finally {
      if (passwordRef.current?.value) passwordRef.current.value = "";
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  const walletName = wallets.find((w) => w.id === walletId)?.name;

  return (
    <>
      <h2 className="mb-1 text-center text-lg font-bold sm:mb-3">
        Migrate Legacy Wallet
      </h2>
      <div className="border-primary-border mb-4 rounded-lg border bg-[var(--primary-bg)] p-4">
        <p className="mb-2 font-semibold text-[var(--text-primary)]">
          Migrating wallet:{" "}
          <strong className="text-[var(--accent-blue)]">{walletName}</strong>
        </p>
        <p className="my-2 text-[var(--text-secondary)]">
          This will create a new wallet using the standard Kaspa derivation path
          (m/44'/111111'/0') that is compatible with Kaspium and other standard
          wallets.
        </p>
        <div className="mt-5 mb-1 flex flex-col items-center rounded-lg border border-[#2a3042] bg-[#1a1f2e] p-4 text-center text-amber-300">
          <AlertTriangle className="h-5 w-5" /> Your original wallet will remain
          unchanged. You'll need to transfer funds to the new wallet addresses.
        </div>
      </div>

      <div className="mb-2 sm:mb-3">
        <label className="mb-1 block text-base font-semibold text-[var(--text-primary)] sm:mb-3">
          New Wallet Name
        </label>
        <input
          ref={nameRef}
          type="text"
          placeholder={`${walletName} (Standard)`}
          defaultValue={`${walletName} (Standard)`}
          onChange={handleInputChange}
          className="focus:!border-kas-primary border-primary-border w-full rounded border bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="mb-3 block text-base font-semibold text-[var(--text-primary)]">
          Password
        </label>
        <input
          ref={passwordRef}
          type="password"
          placeholder="Enter your current wallet password"
          onChange={handleInputChange}
          className="focus:!border-kas-primary border-primary-border w-full rounded border bg-slate-900 p-2.5 text-base text-slate-100 transition-all duration-200 focus:!bg-slate-800 focus:outline-none"
        />
      </div>

      {error && <WalletFlowErrorMessage message={error} />}

      <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
        <Button onClick={onMigrateWallet} variant="primary">
          Create
        </Button>
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
      </div>
    </>
  );
};
