import { FC, useEffect, useState } from "react";
import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { useWalletStore } from "../store/wallet.store";
import { StoredWallet } from "../types/wallet.type";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

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
    <>
      <h4>Security</h4>
      <p className="warning">
        Warning: Never share your seed phrase with anyone. Anyone with access to
        your seed phrase can access your funds.
      </p>
      {!showSeedPhrase ? (
        <div>
          <p>Enter your password to view seed phrase:</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter wallet password"
          />
          <button onClick={handleViewSeedPhrase}>View Seed Phrase</button>
          {error && <p className="error">{error}</p>}
        </div>
      ) : (
        <div>
          <p>Your seed phrase:</p>
          <div className={`seed-phrase ${isBlurred ? "blurred" : ""}`}>
            {seedPhrase}
          </div>
          <div className="visibility-toggle">
            <input
              type="checkbox"
              id="toggleVisibility"
              checked={!isBlurred}
              onChange={(e) => handleBlurToggle(!e.target.checked)}
            />
            <label htmlFor="toggleVisibility" className="eye-icon">
              {isBlurred ? <EyeIcon className="size-6 text-white" /> : <EyeSlashIcon className="size-6 text-white" />}
            </label>
          </div>
          <button
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
      )}
    </>
  );
};
