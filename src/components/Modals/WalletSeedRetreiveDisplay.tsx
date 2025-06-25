import { FC, useEffect, useState } from "react";
import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { useWalletStore } from "../../store/wallet.store";
import { StoredWallet } from "../../types/wallet.type";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

export const WalletSeedRetreiveDisplay: FC = () => {
  const [password, setPassword] = useState("");
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [error, setError] = useState("");
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
    // it is expected that this cleanup phase is only executed on component unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError("");
      if (!selectedWalletId) {
        setError("No wallet selected");
        return;
      }

      // Get the stored wallet data
      const walletsString = localStorage.getItem("wallets");
      if (!walletsString) {
        setError("No wallets found");
        return;
      }

      const storedWallets: StoredWallet[] = JSON.parse(walletsString);
      const foundStoredWallet = storedWallets.find(
        (w) => w.id === selectedWalletId
      );
      if (!foundStoredWallet) {
        setError("Wallet not found");
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
      setError("Invalid password");
    }
  };

  return (
    <div className="mt-2">
      <h4 className="text-lg font-semibold">Security</h4>
      <p className="text-red-500 text-sm font-semibold my-2 text-center">
        Warning: Never share your seed phrase with anyone. Anyone with access to
        your seed phrase can access your funds.
      </p>
      {!showSeedPhrase ? (
        <div>
          <p className="text-white mb-2">
            Enter your password to view seed phrase:
          </p>
          <div className="flex flex-col items-center">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter wallet password"
              className="mb-2 px-4 py-2 w-3/4 bg-black/30 border border-white/10 text-white rounded-md"
            />
            <button
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:outline focus:outline-blue-300 border border-blue-500 text-white rounded flex items-center justify-center w-fit px-3 py-2 shadow transition-all duration-200"
              onClick={handleViewSeedPhrase}
            >
              View Seed Phrase
            </button>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-white mb-2">Your seed phrase:</p>
          <div
            className={clsx(
              "bg-black/30 border border-white/10 text-white px-4 py-3 rounded-md mb-4 font-mono word-break break-all",
              { "filter blur-sm": isBlurred }
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
            <label htmlFor="toggleVisibility" className="cursor-pointer mb-2">
              {isBlurred ? (
                <EyeIcon className="w-6 h-6 text-white" />
              ) : (
                <EyeSlashIcon className="w-6 h-6 text-white" />
              )}
            </label>
          </div>
          <div className="flex justify-center mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:outline focus:outline-blue-300 border border-blue-500 text-white rounded px-3 py-2 shadow transition-all duration-200"
              onClick={() => {
                setShowSeedPhrase(false);
                setSeedPhrase("");
                setPassword("");
                setIsBlurred(true);
              }}
            >
              Hide Seed Phrase
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
