import React, { useState, useEffect, useMemo } from "react";
import { useUiStore } from "../../store/ui.store";
import { useMessagingStore } from "../../store/messaging.store";
import { useWalletStore } from "../../store/wallet.store";
import { useNetworkStore } from "../../store/network.store";
import { Modal } from "../Common/modal";
import { Button } from "../Common/Button";
import clsx from "clsx";
import {
  User,
  Info,
  Settings,
  Sun,
  Moon,
  Monitor,
  Download,
  Trash2,
  Shield,
  Network,
  Save,
  Key,
  ArrowLeft,
  Edit3,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: "account", label: "Account" },
  { id: "theme", label: "Theme" },
  { id: "network", label: "Network" },
  { id: "security", label: "Security" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("account");
  const [isMobile, setIsMobile] = useState(false);
  const { theme, setTheme } = useUiStore();
  const openModal = useUiStore((s) => s.openModal);
  const messageStore = useMessagingStore();
  const walletAddress = useWalletStore((s) => s.address);
  const selectedWalletId = useWalletStore((s) => s.selectedWalletId);
  const wallets = useWalletStore((s) => s.wallets);
  const unlockedWallet = useWalletStore((s) => s.unlockedWallet);
  const changePassword = useWalletStore((s) => s.changePassword);
  const changeWalletName = useWalletStore((s) => s.changeWalletName);
  const networkStore = useNetworkStore();

  // Local settings state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    return localStorage.getItem("kasia-auto-backup-enabled") === "true";
  });
  const [nodeUrl, setNodeUrl] = useState(() => {
    return (
      networkStore.nodeUrl ??
      localStorage.getItem(`kasia_node_url_${networkStore.network}`) ??
      ""
    );
  });
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  // Check if user is already connected to the current URL
  const isAlreadyConnected = useMemo(() => {
    if (!networkStore.isConnected) return false;

    const currentConnectedUrl = networkStore.kaspaClient?.rpc?.url;
    const targetUrl = nodeUrl === "" ? undefined : nodeUrl;

    // Both undefined (using default resolver) or both have same URL
    return currentConnectedUrl === targetUrl;
  }, [networkStore.isConnected, networkStore.kaspaClient?.rpc?.url, nodeUrl]);

  // Track if URL has changed during connection to enable save button
  const [urlChangedDuringConnection, setUrlChangedDuringConnection] =
    useState(false);
  const [lastConnectingUrl, setLastConnectingUrl] = useState<string>("");

  // Track URL changes during connection
  useEffect(() => {
    if (networkStore.isConnecting) {
      if (lastConnectingUrl === "") {
        // Just started connecting, store the URL
        setLastConnectingUrl(nodeUrl);
        setUrlChangedDuringConnection(false);
      } else if (lastConnectingUrl !== nodeUrl) {
        // URL changed during connection
        setUrlChangedDuringConnection(true);
      }
    } else {
      // Connection finished, reset tracking
      setLastConnectingUrl("");
      setUrlChangedDuringConnection(false);
    }
  }, [nodeUrl, networkStore.isConnecting, lastConnectingUrl]);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Wallet name change state
  const [showNameChange, setShowNameChange] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [nameChangeError, setNameChangeError] = useState("");
  const [nameChangeSuccess, setNameChangeSuccess] = useState(false);
  const [isChangingName, setIsChangingName] = useState(false);

  const onClearHistory = () => {
    if (!walletAddress) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(walletAddress.toString());
    }
  };

  const handleSaveNodeUrl = async () => {
    setConnectionSuccess(false);

    // Only prevent save if connecting AND URL hasn't changed
    if (networkStore.isConnecting && !urlChangedDuringConnection) {
      return;
    }

    // Reset URL change tracking since we're now attempting a new connection
    setUrlChangedDuringConnection(false);
    setLastConnectingUrl("");

    networkStore.setNodeUrl(nodeUrl === "" ? undefined : nodeUrl);

    const isSuccess = await networkStore.connect();
    setConnectionSuccess(isSuccess);

    // Hide success/error messages after 5 seconds
    if (isSuccess || networkStore.connectionError) {
      setTimeout(() => {
        setConnectionSuccess(false);
      }, 5000);
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedWalletId) {
      setPasswordChangeError("No wallet selected");
      return;
    }

    // Validate inputs
    if (!currentPassword) {
      setPasswordChangeError("Please enter your current password");
      return;
    }

    if (!newPassword) {
      setPasswordChangeError("Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("New passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      setPasswordChangeError("Password must be at least 4 characters long");
      return;
    }

    setIsChangingPassword(true);
    setPasswordChangeError("");

    try {
      // @TODO(indexdb): should also decrypt and re-encrypt all data with new password
      // mention that we recommend to backup the wallet before changing the password
      await changePassword(selectedWalletId, currentPassword, newPassword);
      setPasswordChangeSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Show success for 2 seconds, then go back
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (error) {
      setPasswordChangeError(
        error instanceof Error ? error.message : "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const resetPasswordChangeForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordChangeError("");
    setPasswordChangeSuccess(false);
    setShowPasswordChange(false);
  };

  const handleNameChange = () => {
    if (!selectedWalletId) {
      setNameChangeError("No wallet selected");
      return;
    }

    // Basic validation (real-time validation handles most cases)
    if (!newWalletName.trim()) {
      setNameChangeError("Please enter a wallet name");
      return;
    }

    if (newWalletName.trim().length < 2) {
      setNameChangeError("Wallet name must be at least 2 characters long");
      return;
    }

    // Don't proceed if there are validation errors
    if (nameChangeError) {
      return;
    }

    setIsChangingName(true);

    try {
      changeWalletName(selectedWalletId, newWalletName.trim());
      setNameChangeSuccess(true);
      setNewWalletName("");

      // Show success for 2 seconds, then go back
      setTimeout(() => {
        setShowNameChange(false);
        setNameChangeSuccess(false);
      }, 2000);
    } catch (error) {
      setNameChangeError(
        error instanceof Error ? error.message : "Failed to change wallet name"
      );
    } finally {
      setIsChangingName(false);
    }
  };

  const resetNameChangeForm = () => {
    setNewWalletName("");
    setNameChangeError("");
    setNameChangeSuccess(false);
    setShowNameChange(false);
  };

  const initializeNameChange = () => {
    // Start with blank input
    setNewWalletName("");
    setShowNameChange(true);
  };

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Update nodeUrl when network changes
  useEffect(() => {
    const savedNodeUrl =
      localStorage.getItem(`kasia_node_url_${networkStore.network}`) ?? "";
    setNodeUrl(networkStore.nodeUrl ?? savedNodeUrl);
  }, [networkStore.network, networkStore.nodeUrl]);

  // Real-time validation for wallet name
  useEffect(() => {
    if (!showNameChange || !newWalletName.trim()) {
      setNameChangeError("");
      return;
    }

    const currentWallet = wallets.find((w) => w.id === selectedWalletId);
    if (currentWallet && newWalletName.trim() === currentWallet.name) {
      setNameChangeError("This is already your current wallet name");
      return;
    }

    // Check for duplicate names with other wallets
    const nameExists = wallets.some(
      (w) =>
        w.id !== selectedWalletId &&
        w.name.toLowerCase() === newWalletName.trim().toLowerCase()
    );

    if (nameExists) {
      setNameChangeError("A wallet with this name already exists");
      return;
    }

    // Clear error if validation passes
    setNameChangeError("");
  }, [newWalletName, wallets, selectedWalletId, showNameChange]);

  // Auto-hide connection messages after 5 seconds
  useEffect(() => {
    if (connectionSuccess) {
      const timer = setTimeout(() => {
        setConnectionSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionSuccess]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("settings-modal-open");
    } else {
      document.body.classList.remove("settings-modal-open");
    }
    return () => {
      document.body.classList.remove("settings-modal-open");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div
        className={clsx("relative", {
          "fixed right-0 bottom-0 left-0 h-[80vh] w-full overflow-hidden rounded-t-3xl rounded-b-none":
            isMobile,
          "h-[600px] w-full max-w-3xl": !isMobile,
        })}
      >
        <div
          className={clsx("flex h-full", {
            "flex-col": isMobile,
            "flex-row": !isMobile,
          })}
        >
          {/* Sidebar */}
          <div
            className={clsx("border-primary-border border-r pr-4", {
              "relative h-[80px] w-full border-r-0 border-b-0 pb-0": isMobile,
              "w-48": !isMobile,
            })}
          >
            <nav
              className={clsx({
                "flex space-x-4 overflow-x-auto pb-2": isMobile,
                "space-y-1": !isMobile,
              })}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                    {
                      "mx-2 min-w-[80px] flex-col items-center justify-center":
                        isMobile,
                      "w-full": !isMobile,
                      "text-primary border-primary border-b-2":
                        isMobile && activeTab === tab.id,
                      "text-primary bg-primary-bg border-primary-border rounded-lg border":
                        !isMobile && activeTab === tab.id,
                      "text-muted-foreground": activeTab !== tab.id,
                    }
                  )}
                >
                  {/* Tab icons */}
                  {tab.id === "account" && (
                    <User className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.id === "theme" && (
                    <Monitor className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.id === "network" && (
                    <Network className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.id === "security" && (
                    <Shield className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.label}
                </button>
              ))}
            </nav>
            {isMobile && (
              <div className="bg-primary-border absolute right-0 bottom-[-20px] left-0 z-10 h-[1px]"></div>
            )}
          </div>
          {/* Content */}
          <div
            className={clsx("flex-1 overflow-y-auto p-6", {
              "h-[calc(80vh-80px)]": isMobile,
            })}
          >
            {activeTab === "account" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                {!showNameChange ? (
                  <>
                    <h3 className="mb-4 text-lg font-medium">Account</h3>
                    <div className="space-y-4">
                      {/* Current Wallet Info */}
                      {unlockedWallet && (
                        <div className="bg-primary-bg border-primary-border rounded-2xl border p-4">
                          <div className="mb-2 text-sm font-bold">
                            Your Wallet:
                          </div>
                          <div className="text-muted-foreground text-kas-secondary text-lg font-bold">
                            {unlockedWallet.name}
                          </div>
                        </div>
                      )}

                      {/* Change Wallet Name */}
                      <button
                        onClick={initializeNameChange}
                        className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors"
                      >
                        <Edit3 className="h-5 w-5" />
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Change Wallet Name
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Update your wallet's display name
                          </div>
                        </div>
                      </button>
                      {/* Import/Export Messages */}
                      {messageStore.isLoaded && (
                        <button
                          onClick={() => {
                            openModal("backup");
                            onClose();
                          }}
                          className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors"
                        >
                          <Download className="h-5 w-5" />
                          <div className="text-left">
                            <div className="text-sm font-medium">
                              Import / Export Messages
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Backup or restore your message history
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Delete All Messages */}
                      <button
                        onClick={() => {
                          onClearHistory();
                          onClose();
                        }}
                        className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors"
                      >
                        <Trash2 className="h-5 w-5 text-red-400/50" />
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Delete All Messages
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Permanently remove all conversations and data
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        onClick={resetNameChangeForm}
                        className="hover:text-primary text-muted-foreground p-1 transition-colors"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <h3 className="text-lg font-medium">
                        Change Wallet Name
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {nameChangeSuccess ? (
                        <div className="border-primary-border rounded-lg border p-4 text-center">
                          <div className="mb-2 text-green-500">
                            Wallet name changed successfully!
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Your wallet name has been updated.
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Wallet Name Input */}
                          <div>
                            <label
                              htmlFor="wallet-name"
                              className="mb-2 block text-sm font-medium"
                            >
                              Wallet Name
                            </label>
                            <input
                              type="text"
                              id="wallet-name"
                              value={newWalletName}
                              onChange={(e) => setNewWalletName(e.target.value)}
                              className="border-primary-border bg-primary-bg text-primary focus:ring-kas-secondary/80 w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                              placeholder="Enter wallet name"
                              disabled={isChangingName}
                              maxLength={50}
                            />
                          </div>

                          {/* Error Message */}
                          {nameChangeError && (
                            <div className="text-sm text-red-500">
                              {nameChangeError}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                              onClick={handleNameChange}
                              variant="primary"
                              disabled={
                                isChangingName ||
                                !newWalletName.trim() ||
                                !!nameChangeError
                              }
                              className="sm:flex-1"
                            >
                              {isChangingName ? "Changing..." : "Confirm"}
                            </Button>
                            <Button
                              onClick={resetNameChangeForm}
                              variant="secondary"
                              disabled={isChangingName}
                              className="sm:flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {activeTab === "theme" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                <h3 className="mb-4 text-lg font-medium">Theme</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={clsx(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                      theme === "light"
                        ? "bg-kas-secondary/10 border-kas-secondary"
                        : "bg-primary-bg border-primary-border hover:bg-secondary-bg"
                    )}
                  >
                    <Sun className="h-5 w-5 text-[var(--text-primary)]" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={clsx(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                      theme === "dark"
                        ? "bg-kas-secondary/10 border-kas-secondary"
                        : "bg-primary-bg border-primary-border hover:bg-secondary-bg"
                    )}
                  >
                    <Moon className="h-5 w-5 text-[var(--text-primary)]" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={clsx(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                      theme === "system"
                        ? "bg-kas-secondary/10 border-kas-secondary"
                        : "bg-primary-bg border-primary-border hover:bg-secondary-bg"
                    )}
                  >
                    <Monitor className="h-5 w-5 text-[var(--text-primary)]" />
                    <span className="text-sm font-medium">System</span>
                  </button>
                </div>
              </div>
            )}
            {activeTab === "network" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                <h3 className="mb-4 text-lg font-medium">Network Settings</h3>
                <div className="space-y-4">
                  {/* Current Network */}
                  <div className="border-primary-border bg-primary-bg rounded-2xl border p-4">
                    <div className="mb-2 text-sm font-medium">
                      Current Network
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <div
                        className={clsx(
                          "h-2 w-2 rounded-full",
                          networkStore.isConnected
                            ? "bg-green-500"
                            : "bg-red-500"
                        )}
                      />
                      {networkStore.network}{" "}
                      {networkStore.isConnected
                        ? "(Connected)"
                        : "(Disconnected)"}
                    </div>
                  </div>

                  {/* Node URL Input */}
                  <div className="border-primary-border bg-primary-bg rounded-2xl border p-4">
                    <div className="mb-2 text-sm font-medium">
                      Custom Node URL
                    </div>
                    <div className="text-muted-foreground mb-3 text-xs">
                      Force using a specific node URL for the selected network.
                      Leave empty to use automatic resolver.
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={nodeUrl}
                        onChange={(e) => setNodeUrl(e.target.value)}
                        className="border-primary-border bg-secondary-bg text-primary focus:ring-kas-secondary/80 flex-1 rounded-lg border p-2 text-sm focus:ring-2 focus:outline-none"
                        placeholder="wss://your-node-url.com"
                      />
                      <button
                        onClick={handleSaveNodeUrl}
                        disabled={
                          (networkStore.isConnecting &&
                            !urlChangedDuringConnection) ||
                          isAlreadyConnected
                        }
                        className="hover:bg-primary/80 bg-primary flex items-center justify-start gap-1 rounded px-3 py-2 text-sm transition-colors disabled:opacity-50"
                      >
                        {networkStore.isConnecting &&
                        !urlChangedDuringConnection ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                    {connectionSuccess && (
                      <div className="mt-2 text-sm text-green-500">
                        Successfully connected to the node!
                      </div>
                    )}
                    {networkStore.connectionError && (
                      <div className="mt-2 text-sm text-red-500">
                        Error: {networkStore.connectionError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "security" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                {!showPasswordChange ? (
                  <>
                    <h3 className="mb-4 text-lg font-medium">Security</h3>
                    <div className="space-y-4">
                      {/* Change Password */}
                      <button
                        onClick={() => setShowPasswordChange(true)}
                        className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors"
                      >
                        <Key className="h-5 w-5" />
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Change Password
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Update the password used to unlock your wallet
                          </div>
                        </div>
                      </button>

                      {/* Wallet Security */}
                      <div className="border-primary-border border-text-warning/50 bg-text-warning/5 rounded-2xl border p-4">
                        <div className="text-text-warning mb-2 text-sm font-medium">
                          Wallet Security
                        </div>
                        <div className="text-text-warning/80 text-xs">
                          Your wallet is protected by your password. Keep your
                          password and seed phrase secure.
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        onClick={resetPasswordChangeForm}
                        className="hover:text-primary text-muted-foreground p-1 transition-colors"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <h3 className="text-lg font-medium">Change Password</h3>
                    </div>

                    <div className="space-y-4">
                      {passwordChangeSuccess ? (
                        <div className="border-primary-border rounded-2xl border p-4 text-center">
                          <div className="mb-2 text-green-500">
                            Password changed successfully!
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Your wallet password has been updated.
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Current Password */}
                          <div>
                            <label
                              htmlFor="current-password"
                              className="mb-2 block text-sm font-medium"
                            >
                              Current Password
                            </label>
                            <input
                              type="password"
                              id="current-password"
                              value={currentPassword}
                              onChange={(e) =>
                                setCurrentPassword(e.target.value)
                              }
                              className="border-primary-border bg-primary-bg text-primary focus:ring-kas-secondary/80 w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                              placeholder="Enter your current password"
                              disabled={isChangingPassword}
                            />
                          </div>

                          {/* New Password */}
                          <div>
                            <label
                              htmlFor="new-password"
                              className="mb-2 block text-sm font-medium"
                            >
                              New Password
                            </label>
                            <input
                              type="password"
                              id="new-password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="border-primary-border bg-primary-bg text-primary focus:ring-kas-secondary/80 w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                              placeholder="Enter your new password"
                              disabled={isChangingPassword}
                            />
                          </div>

                          {/* Confirm New Password */}
                          <div>
                            <label
                              htmlFor="confirm-password"
                              className="mb-2 block text-sm font-medium"
                            >
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              id="confirm-password"
                              value={confirmPassword}
                              onChange={(e) =>
                                setConfirmPassword(e.target.value)
                              }
                              className="border-primary-border bg-primary-bg text-primary focus:ring-kas-secondary/80 w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                              placeholder="Confirm your new password"
                              disabled={isChangingPassword}
                            />
                          </div>

                          {/* Error Message */}
                          {passwordChangeError && (
                            <div className="text-sm text-red-500">
                              {passwordChangeError}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                              onClick={handlePasswordChange}
                              variant="primary"
                              disabled={
                                isChangingPassword ||
                                !currentPassword ||
                                !newPassword ||
                                !confirmPassword
                              }
                              className="sm:flex-1"
                            >
                              {isChangingPassword ? "Changing..." : "Confirm"}
                            </Button>
                            <Button
                              onClick={resetPasswordChangeForm}
                              variant="secondary"
                              disabled={isChangingPassword}
                              className="sm:flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
