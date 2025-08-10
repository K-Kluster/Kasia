import { FC, useEffect, useState } from "react";
import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { useWalletStore } from "../../store/wallet.store";
import { StoredWallet } from "../../types/wallet.type";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast-helper";
import { StringCopy } from "../Common/StringCopy";

export const WalletSeedRetreiveDisplay: FC = () => {
  const [password, setPassword] = useState("");
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [isBlurred, setIsBlurred] = useState(true);
  const selectedWalletId = useWalletStore((state) => state.selectedWalletId);
  const [blurTimeout, setBlurTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
    };
  }, [blurTimeout]);

  const handleBlurToggle = (shouldBlur: boolean) => {
    // Clear any existing timeout
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      setBlurTimeout(null);
    }

    setIsBlurred(shouldBlur);

    // If unblurring, set a timeout to re-blur after 5 seconds
    if (!shouldBlur) {
      setBlurTimeout(
        setTimeout(() => {
          setIsBlurred(true);
        }, 5000)
      );
    }
  };

  const handleViewSeedPhrase = async () => {
    try {
      if (!selectedWalletId) {
        toast.error("No wallet selected");
        return;
      }

      // Get the stored wallet data
      const walletsString = localStorage.getItem("wallets");
      if (!walletsString) {
        toast.error("No wallets found");
        return;
      }

      const storedWallets: StoredWallet[] = JSON.parse(walletsString);
      const foundStoredWallet = storedWallets.find(
        (w) => w.id === selectedWalletId
      );
      if (!foundStoredWallet) {
        toast.error("Wallet not found");
        return;
      }

      // Decrypt the seed phrase
      const phrase = decryptXChaCha20Poly1305(
        foundStoredWallet.encryptedPhrase,
        password
      );
      setSeedPhrase(phrase);
      setShowSeedPhrase(true);
    } catch (error) {
      console.error("Error viewing seed phrase:", error);
      toast.error("Invalid password");
    }
  };

  return (
    <div className="mt-2">
      <h4 className="text-center text-lg font-semibold">Security</h4>
      <p className="text-text-warning my-2 text-center text-sm font-semibold">
        Warning: Never share your seed phrase with anyone. Anyone with access to
        your seed phrase can access your funds.
      </p>
      {!showSeedPhrase ? (
        <div>
          <p className="mb-2 p-2 text-center font-semibold">
            Enter your password to view seed phrase:
          </p>
          <div className="flex flex-col items-center">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter wallet password"
              className="border-primary-border bg-primary-bg mb-2 w-full rounded-3xl border px-4 py-2 md:w-3/4"
            />
            <Button
              onClick={handleViewSeedPhrase}
              variant="primary"
              className="md:w-3/4"
            >
              View Seed Phrase
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 p-2 text-center font-semibold">
            Your seed phrase:
          </p>
          <div
            className={clsx(
              "word-break border-primary-border bg-primary-bg mb-4 rounded-3xl border px-4 py-3 font-mono break-all",
              { "blur-sm filter": isBlurred }
            )}
          >
            {seedPhrase}
          </div>
          <div className="flex items-center justify-center gap-2">
            <input
              type="checkbox"
              id="toggleVisibility"
              checked={!isBlurred}
              onChange={(e) => handleBlurToggle(!e.target.checked)}
              className="hidden"
            />
            <label htmlFor="toggleVisibility" className="mb-2 cursor-pointer">
              {isBlurred ? (
                <Eye className="h-6 w-6" />
              ) : (
                <EyeOff className="h-6 w-6" />
              )}
            </label>
            <StringCopy
              text={seedPhrase}
              alertText="Seed phrase copied to clipboard"
              titleText="Copy seed phrase"
              iconClass="h-6 w-6"
              className="mb-2 p-1"
            />
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => {
                setShowSeedPhrase(false);
                setSeedPhrase("");
                setPassword("");
                setIsBlurred(true);
              }}
              variant="secondary"
              className="px-3 py-2 shadow"
            >
              Hide Seed Phrase
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
