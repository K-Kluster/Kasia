import { useEffect, useRef, useState } from "react";
import { NetworkSelector } from "../NetworkSelector";
import { NetworkType } from "../../types/all";
import { Wallet } from "../../types/wallet.type";
import { Button } from "../Common/Button";
import { WalletFlowErrorMessage } from "./WalletFlowErrorMessage";
import { Loader2 } from "lucide-react";

import {
  StartSessionInvalidPasswordException,
  useOrchestrator,
} from "../../hooks/useOrchestrator";
import { useSessionState } from "../../store/session.store";
import { PasswordField } from "../Common/PasswordField";

type UnlockWalletProps = {
  selectedWalletId: string | null;
  wallets: Wallet[];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
  isConnecting: boolean;
  onSuccess: (walletId: string) => void;
  onBack: () => void;
};

export const Unlock = ({
  selectedWalletId,
  wallets,
  selectedNetwork,
  onNetworkChange,
  isConnected,
  isConnecting,
  onSuccess,
  onBack,
}: UnlockWalletProps) => {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  const { startSession } = useOrchestrator();
  const { getSession, setSession, hasSession } = useSessionState();

  const usePasswordRef = (node: HTMLInputElement | null) => {
    passwordRef.current = node;
    node?.focus();
  };

  const onUnlockWallet = async () => {
    const pass = passwordRef.current?.value;
    if (!selectedWalletId || !pass) {
      setError("Please enter your account password");
      return;
    }
    setError(null);
    try {
      setUnlocking(true);

      // do it lossely in the background to not lock the thread
      setSession(selectedWalletId, pass);

      await startSession({ walletId: selectedWalletId, walletPassword: pass });

      onSuccess(selectedWalletId);
    } catch (err) {
      console.error("Unlock error:", err);
      if (passwordRef.current) {
        passwordRef.current.value = "";
        passwordRef.current.focus();
      }
      const msg =
        err instanceof StartSessionInvalidPasswordException
          ? "Incorrect password. Please try again."
          : "Failed to unlock account. Please try again.";
      setError(msg);
    } finally {
      setUnlocking(false);
    }
  };

  // session restore effect
  useEffect(() => {
    if (!selectedWalletId) {
      return;
    }
    const sessionEffect = async () => {
      if (await hasSession(selectedWalletId)) {
        const password = await getSession(selectedWalletId);

        if (password && passwordRef?.current) {
          passwordRef.current.value = password;

          onUnlockWallet();
        }
      }
    };

    sessionEffect();
  }, []);

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) setError(null);
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div inert className="flex w-full justify-center opacity-70">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
          isConnecting={isConnecting}
        />
      </div>

      {wallets.find((w) => w.id === selectedWalletId) && (
        <div className="flex justify-center">
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
            Unlocking Account
          </span>
          <Loader2 className="my-2 h-14 w-14 animate-spin text-gray-500" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUnlockWallet();
          }}
        >
          {/* hidden username field for password manager accessibility */}
          <input
            type="text"
            name="username"
            value={wallets.find((w) => w.id === selectedWalletId)?.name || ""}
            autoComplete="username"
            style={{ display: "none" }}
            readOnly
            tabIndex={-1}
          />

          <div className="mb-3.5">
            <PasswordField
              label="Password"
              classLabel="mb-3.5 block font-semibold"
              classInput="focus:!border-kas-primary border-primary-border bg-input-bg w-full rounded-3xl border p-2.5 px-4 text-base transition-all duration-200 focus:outline-none"
              hasError={!!error}
              ref={usePasswordRef}
              placeholder="Enter your password"
              onChange={handleInputChange}
              disabled={unlocking}
              required
            />
          </div>

          {error && <WalletFlowErrorMessage message={error} />}

          <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
            <Button
              type="submit"
              disabled={unlocking || !isConnected}
              variant="primary"
              title={
                !isConnected ? "Waiting for network connection…" : undefined
              }
            >
              Unlock
            </Button>

            <Button
              type="button"
              onClick={onBack}
              disabled={unlocking}
              variant="secondary"
            >
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
