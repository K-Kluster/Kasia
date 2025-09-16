import { FC, useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { useAuthStore } from "../../store/auth.store";
import { useUiStore } from "../../store/ui.store";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast-helper";
import { WalletStorageService } from "../../service/wallet-storage-service";
import { completePasswordReauth } from "../../utils/password-reauth";

export const PasswordReauthModal: FC = () => {
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletStore = useWalletStore();
  const authStore = useAuthStore();
  const uiStore = useUiStore();
  const selectedWalletId = walletStore.selectedWalletId;
  const unlockedWallet = walletStore.unlockedWallet;

  const handleReauth = async () => {
    if (!selectedWalletId || !password) {
      setError("Please enter your password");
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // check the password by verifying it without fully decrypting wallet
      const walletStorage = new WalletStorageService();
      walletStorage.verifyPassword(selectedWalletId, password);

      // if successful, update the last password entry timestamp
      authStore.updateLastPasswordEntry();

      completePasswordReauth(true);
      uiStore.closeModal("password-reauth");

      // clear the password field
      setPassword("");

      toast.success("Authentication Successful");
    } catch (error) {
      console.error("Password reauthentication failed:", error);
      setError("Incorrect password. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleClose = () => {
    // complete reauth as failed (cancelled)
    completePasswordReauth(false);
    uiStore.closeModal("password-reauth");
    setPassword("");
    setError(null);
  };

  // clear error when user starts typing
  const handleInputChange = (value: string) => {
    setPassword(value);
    if (error) setError(null);
  };

  if (!unlockedWallet) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
        Re-enter Password
      </h3>
      <p className="text-sm text-[var(--text-secondary)]">
        You've been signed in a while. Please enter your password to continue
        with this transaction.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleReauth();
        }}
        className="mt-6 space-y-4"
      >
        {/* hidden username field for password manager stuff */}
        <input
          type="text"
          name="username"
          value="wallet-reauth"
          autoComplete="username"
          style={{ display: "none" }}
          readOnly
          tabIndex={-1}
        />
        <div>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Enter wallet password"
            autoComplete="current-password"
            className="w-full rounded-3xl border border-[var(--primary-border)] bg-[var(--primary-bg)] px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
            required
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-[var(--accent-red)]">{error}</p>}

        <div className="flex justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isAuthenticating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isAuthenticating || !password}
          >
            {isAuthenticating ? "Authenticating..." : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
};
