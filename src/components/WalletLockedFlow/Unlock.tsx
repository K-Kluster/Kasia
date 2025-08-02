import { useRef, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { NetworkSelector } from "../NetworkSelector";
import { NetworkType } from "../../types/all";
import { Wallet } from "../../types/wallet.type";
import { Button } from "../Common/Button";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

type UnlockWalletProps = {
  selectedWalletId: string | null;
  wallets: Wallet[];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
  onSuccess: (walletId: string) => void;
  onBack: () => void;
};

export const Unlock = ({
  selectedWalletId,
  wallets,
  selectedNetwork,
  onNetworkChange,
  isConnected,
  onSuccess,
  onBack,
}: UnlockWalletProps) => {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  const { unlock } = useWalletStore();

  const usePasswordRef = (node: HTMLInputElement | null) => {
    passwordRef.current = node;
    node?.focus();
  };

  const onUnlockWallet = async () => {
    const pass = passwordRef.current?.value;
    if (!selectedWalletId || !pass) {
      setError("Please enter your wallet password");
      return;
    }
    setError(null);
    try {
      setUnlocking(true);
      await unlock(selectedWalletId, pass);
      onSuccess(selectedWalletId);
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
      setError(msg);
    } finally {
      setUnlocking(false);
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  return (
    <>
      <div inert className="mb-4 flex w-full justify-center opacity-70">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
      </div>

      {wallets.find((w) => w.id === selectedWalletId) && (
        <div className="mt-16 mb-5 flex justify-center">
          <div className="border-kas-secondary bg-kas-secondary/10 rounded-md border px-4 py-2 text-center">
            <span className="text-lg font-bold">
              {wallets.find((w) => w.id === selectedWalletId)?.name}
            </span>
          </div>
        </div>
      )}

      {unlocking ? (
        <div className="relative my-2 flex h-full flex-col items-center justify-center space-y-4">
          <span className="text-sm font-medium tracking-wide text-gray-300 sm:text-lg">
            Unlocking Wallet…
          </span>
          <Loader2 className="my-2 h-14 w-14 animate-spin text-gray-500" />
        </div>
      ) : (
        <>
          <div className="mb-3.5">
            <label className="mb-3.5 block font-medium">Password</label>
            <input
              autoComplete="current-password"
              ref={usePasswordRef}
              type="password"
              placeholder="Enter your password"
              onChange={handleInputChange}
              className={clsx(
                "focus:!border-kas-primary border-primary-border bg-input-bg w-full rounded-3xl border p-2.5 px-4 text-base transition-all duration-200 focus:outline-none",
                { "!border-red-500": error }
              )}
              onKeyDown={(e) => e.key === "Enter" && onUnlockWallet()}
              disabled={unlocking}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

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

            <Button onClick={onBack} disabled={unlocking} variant="secondary">
              Back
            </Button>
          </div>
        </>
      )}
    </>
  );
};
