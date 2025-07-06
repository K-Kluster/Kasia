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
  isWalletReady,
}) => {
  const open = useUiStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const msgStore = useMessagingStore();
  const [actionsOpen, setActionsOpen] = useState(false);
  const { openModal } = useUiStore();

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
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Draw type thing */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col bg-[var(--primary-bg)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border-color)] p-4">
          <button
            onClick={() => setSettingsOpen(false)}
            className="cursor-pointer p-2"
            aria-label="Close menu"
          >
            <ChevronLeftIcon className="h-6 w-6 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/kasia-logo.png"
              alt="Kasia Logo"
              className="-mr-6 h-[50px] w-[50px] object-contain"
            />
            <div className="ml-4 text-lg font-semibold text-[var(--text-primary)]">
              Kasia
            </div>
          </div>
        </header>

        <ul className="flex flex-1 flex-col divide-y divide-gray-700 overflow-auto">
          <li
            onClick={() => {
              openModal("address");
            }}
            className={clsx(
              "flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700",
              { "pointer-events-none opacity-50": !address }
            )}
          >
            <UserIcon className="h-5 w-5 text-white" />
            <span className="flex-1 text-sm text-white">
              Show Address
              {!address && (
                <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
              )}
            </span>
          </li>

          <li
            onClick={() => {
              openModal("walletInfo");
            }}
            className={clsx(
              "flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700",
              { "pointer-events-none opacity-50": !address }
            )}
          >
            <InformationCircleIcon className="h-5 w-5 text-white" />
            <span className="flex flex-1 items-center text-sm text-white">
              Wallet Info
              {!address && (
                <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
              )}
            </span>
          </li>

          <li
            onClick={() => setActionsOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700"
          >
            {actionsOpen ? (
              <ChevronDownIcon className="h-5 w-5 text-white" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-white" />
            )}
            <span className="text-sm text-white">Actions</span>
          </li>

          {actionsOpen && (
            <ul className="ml-4 text-center text-sm font-semibold">
              <li
                onClick={() => {
                  openModal("withdraw");
                  setActionsOpen(false);
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                Withdraw Funds
              </li>
              <li
                onClick={() => {
                  openModal("utxo-compound");
                  setActionsOpen(false);
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                <span className="text-sm text-white">Compound UTXOs</span>
              </li>
              {msgStore.isLoaded && (
                <li
                  onClick={() => {
                    openModal("backup");
                    setActionsOpen(false);
                  }}
                  className="cursor-pointer px-4 py-3 hover:bg-gray-700"
                >
                  Import / Export Messages
                </li>
              )}

              <li
                onClick={clearHistory}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                Delete All Messages
              </li>

              <li
                onClick={() => {
                  openModal("seed");
                  setActionsOpen(false);
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                View Seed Phrase
              </li>
            </ul>
          )}

          <li className="block px-4 py-3 sm:hidden">
            <FeeBuckets inline={false} />
          </li>

          <li
            onClick={onCloseWallet}
            className="mt-auto flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700"
          >
            <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
            <span className="text-base text-red-500">Close Wallet</span>
          </li>
        </ul>
      </aside>
    </>
  );
};
