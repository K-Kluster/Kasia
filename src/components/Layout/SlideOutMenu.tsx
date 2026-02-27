import { FC, useState, useEffect } from "react";
import clsx from "clsx";
import {
  RefreshCcw,
  User,
  ArrowLeft,
  Wallet,
  X,
  DatabaseZap,
} from "lucide-react";
import { Settings } from "lucide-react";
import { useUiStore } from "../../store/ui.store";
import { isIndexerDisabled } from "../../utils/indexer-settings";

type SlideOutMenuProps = {
  address?: string;
  onCloseWallet: () => void;
  isWalletReady: boolean;
};

export const SlideOutMenu: FC<SlideOutMenuProps> = ({
  address,
  onCloseWallet,
  isWalletReady,
}) => {
  const open = useUiStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const { openModal } = useUiStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      // small delay to ensure component is rendered before animating in
      setTimeout(() => setMounted(true), 10);
    } else {
      setMounted(false);
    }
  }, [open]);

  const handleClose = () => {
    setMounted(false);
    setTimeout(() => {
      setSettingsOpen(false);
    }, 300);
  };

  if (!open || !isWalletReady) return null;

  return (
    <>
      {/* Modal Darkness */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          {
            "opacity-0": !mounted,
            "opacity-100": mounted,
          }
        )}
        onClick={handleClose}
      />

      {/* Draw type thing */}
      <aside
        className={clsx(
          "bg-secondary-bg fixed top-[var(--sat)] bottom-[var(--sab)] left-0 z-45 flex w-full max-w-3/4 flex-col shadow-xl transition-transform duration-300 ease-out",
          {
            "-translate-x-full": !mounted,
            "translate-x-0": mounted,
          }
        )}
      >
        <header className="border-primary-border flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <img
              src="/kasia-logo.png"
              alt="Kasia Logo"
              className="h-[50px] w-[50px] object-contain"
            />
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                Kasia
              </div>
              {isIndexerDisabled() && (
                <DatabaseZap className="size-5 text-[var(--accent-red)]" />
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="cursor-pointer rounded-lg p-2 transition-colors active:bg-gray-700"
            aria-label="Close menu"
          >
            <X className="h-6 w-6 text-[var(--text-primary)]" />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-auto">
          {/* Wallet Operations Section */}
          <div className="border-primary-border p-6">
            <div className="mb-4">
              <h3 className="text-base font-medium text-[var(--text-secondary)]">
                Wallet Operations
              </h3>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  openModal("address");
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-4 transition-colors active:bg-gray-700",
                  { "pointer-events-none opacity-50": !address }
                )}
              >
                <User className="h-6 w-6 text-[var(--text-primary)]" />
                <span className="flex items-center text-base text-[var(--text-primary)]">
                  Show Address
                  {!address && (
                    <RefreshCcw className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </span>
              </button>

              <div className="my-2 w-full border-b border-[var(--text-secondary)]/30"></div>
              <button
                onClick={() => {
                  openModal("walletInfo");
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-4 transition-colors active:bg-gray-700",
                  { "pointer-events-none opacity-50": !address }
                )}
              >
                <Wallet className="h-6 w-6 text-[var(--text-primary)]" />
                <span className="flex items-center text-base text-[var(--text-primary)]">
                  Wallet
                  {!address && (
                    <RefreshCcw className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Sign Out Section */}
          <div className="border-primary-border mt-auto border-t p-3">
            <button
              onClick={() => openModal("settings-unlocked")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-4 transition-colors active:bg-gray-700"
            >
              <Settings className="h-5 w-5 text-[var(--text-primary)]" />
              <span className="text-base text-[var(--text-primary)]">
                Settings
              </span>
            </button>
            <div className="my-2 w-full border-b border-[var(--text-secondary)]/30"></div>
            <button
              onClick={onCloseWallet}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors active:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5 text-[var(--accent-red)]" />
              <span className="text-base text-[var(--accent-red)]">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
