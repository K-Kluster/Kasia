import { FC, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  RefreshCcw,
  User,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Info,
  CreditCard,
  X,
} from "lucide-react";
import { Settings } from "lucide-react";
import { useMessagingStore } from "../../store/messaging.store";

import { FeeBuckets } from "../FeeBuckets";
import { useUiStore } from "../../store/ui.store";
import { SettingsModal } from "../Modals/SettingsModal";

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

  const msgStore = useMessagingStore();
  const [actionsOpen, setActionsOpen] = useState(false);
  const { openModal } = useUiStore();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (!open) {
      setActionsOpen(false);
    }
  }, [open]);

  const clearHistory = useCallback(() => {
    if (!address) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      msgStore.flushWalletHistory(address);
      setActionsOpen(false);
    }
  }, [address, msgStore]);

  if (!open || !isWalletReady) return null;

  return (
    <>
      {/* Modal Darkness */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Draw type thing */}
      <aside className="bg-secondary-bg fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col shadow-xl">
        <header className="border-primary-border flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <img
              src="/kasia-logo.png"
              alt="Kasia Logo"
              className="h-[50px] w-[50px] object-contain"
            />
            <div className="text-lg font-semibold text-[var(--text-primary)]">
              Kasia
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-gray-700"
            aria-label="Close menu"
          >
            <X className="h-6 w-6 text-[var(--text-primary)]" />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-auto">
          {/* Wallet Operations Section */}
          <div className="border-primary-border border-b p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
              Wallet Operations
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  openModal("address");
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700",
                  { "pointer-events-none opacity-50": !address }
                )}
              >
                <User className="h-5 w-5 text-[var(--text-primary)]" />
                <span className="flex items-center text-sm text-[var(--text-primary)]">
                  Show Address
                  {!address && (
                    <RefreshCcw className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </span>
              </button>

              <button
                onClick={() => {
                  openModal("walletInfo");
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700",
                  { "pointer-events-none opacity-50": !address }
                )}
              >
                <Info className="h-5 w-5 text-[var(--text-primary)]" />
                <span className="flex items-center text-sm text-[var(--text-primary)]">
                  Wallet Info
                  {!address && (
                    <RefreshCcw className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </span>
              </button>

              {/* Actions Dropdown */}
              <div>
                <button
                  onClick={() => setActionsOpen((v) => !v)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
                >
                  {actionsOpen ? (
                    <ChevronDown className="h-5 w-5 text-[var(--text-primary)]" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  <span className="text-sm text-[var(--text-primary)]">
                    Actions
                  </span>
                </button>

                {actionsOpen && (
                  <div className="mt-2 ml-4 space-y-1">
                    <button
                      onClick={() => {
                        openModal("withdraw");
                        setActionsOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
                    >
                      <CreditCard className="h-5 w-5 text-[var(--text-primary)]" />
                      <span className="text-sm text-[var(--text-primary)]">
                        Withdraw Funds
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        openModal("utxo-compound");
                        setActionsOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
                    >
                      <CreditCard className="h-5 w-5 text-[var(--text-primary)]" />
                      <span className="text-sm text-[var(--text-primary)]">
                        Compound UTXOs
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        openModal("seed");
                        setActionsOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
                    >
                      <CreditCard className="h-5 w-5 text-[var(--text-primary)]" />
                      <span className="text-sm text-[var(--text-primary)]">
                        Seed Phrase
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fee Buckets Section */}
          <div className="p-4">
            <FeeBuckets inline={false} />
          </div>

          {/* Sign Out Section */}
          <div className="border-primary-border mt-auto border-t p-4">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
            >
              <Settings className="h-5 w-5 text-[var(--text-primary)]" />
              <span className="text-sm text-[var(--text-primary)]">
                Settings
              </span>
            </button>
            <button
              onClick={onCloseWallet}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5 text-red-500" />
              <span className="text-base text-red-500">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
};
