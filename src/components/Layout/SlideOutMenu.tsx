import { FC, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { useMessagingStore } from "../../store/messaging.store";
import { useModals } from "../../context/ModalContext";
import { FeeBuckets } from "../FeeBuckets";
import { useUiStore } from "../../store/ui.store";

type SlideOutMenuProps = {
  address?: string;
  onCloseWallet: () => void;
  isWalletReady: boolean;
};

export const SlideOutMenu: FC<SlideOutMenuProps> = ({
  address,
  onCloseWallet,
  isWalletReady
}) => {
  const open = useUiStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const msgStore = useMessagingStore();
  const [actionsOpen, setActionsOpen] = useState(false);
  const { openModal } = useModals();

  useEffect(() => {
    if (!open) {
      setActionsOpen(false);
    }
  }, [open]);

  const clearHistory = useCallback(() => {
    if (!address) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This cannot be undone."
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
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Draw type thing */}
      <aside
        className="
    fixed inset-y-0 left-0 z-50
    w-full max-w-xs
    bg-[var(--primary-bg)] shadow-xl
    flex flex-col
  "
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-2 cursor-pointer"
            aria-label="Close menu"
          >
            <ChevronLeftIcon className="h-6 w-6 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/kasia-logo.png"
              alt="Kasia Logo"
              className="w-[50px] h-[50px] object-contain -mr-6"
            />
            <div className="ml-4 text-lg font-semibold text-[var(--text-primary)]">
              Kasia
            </div>
          </div>
        </header>

        <ul className="flex flex-col flex-1 overflow-auto divide-y divide-gray-700">
          <li
            onClick={() => {
              openModal("address");
            }}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer",
              { "opacity-50 pointer-events-none": !address }
            )}
          >
            <UserIcon className="h-5 w-5 text-white" />
            <span className="flex-1 text-white text-sm">
              Show Address
              {!address && (
                <ArrowPathIcon className="animate-spin h-5 w-5 ml-2 text-gray-500" />
              )}
            </span>
          </li>

          <li
            onClick={() => {
              openModal("walletInfo");
            }}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer",
              { "opacity-50 pointer-events-none": !address }
            )}
          >
            <InformationCircleIcon className="h-5 w-5 text-white" />
            <span className="flex-1 text-white text-sm flex items-center">
              Wallet Info
              {!address && (
                <ArrowPathIcon className="animate-spin h-5 w-5 ml-2 text-gray-500" />
              )}
            </span>
          </li>

          <li
            onClick={() => setActionsOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
          >
            {actionsOpen ? (
              <ChevronDownIcon className="h-5 w-5 text-white" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-white" />
            )}
            <span className="text-white text-sm">Actions</span>
          </li>

          {actionsOpen && (
            <ul className="ml-4 text-sm font-semibold text-center">
              <li
                onClick={() => {
                  openModal("withdraw");
                  setActionsOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                Withdraw Funds
              </li>

              {msgStore.isLoaded && (
                <li
                  onClick={() => {
                    openModal("backup");
                    setActionsOpen(false);
                  }}
                  className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
                >
                  Import / Export Messages
                </li>
              )}

              <li
                onClick={clearHistory}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                Delete All Messages
              </li>

              <li
                onClick={() => {
                  openModal("seed");
                  setActionsOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                View Seed Phrase
              </li>
            </ul>
          )}

          <li className="block sm:hidden px-4 py-3">
            <FeeBuckets inline={false} />
          </li>

          <li
            onClick={onCloseWallet}
            className="
               mt-auto
               flex items-center gap-2
               px-4 py-3 hover:bg-gray-700 cursor-pointer
             "
          >
            <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
            <span className="text-red-500 text-base">Close Wallet</span>
          </li>
        </ul>
      </aside>
    </>
  );
};
