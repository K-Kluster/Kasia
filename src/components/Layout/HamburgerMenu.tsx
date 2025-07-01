import { FC, useState, useEffect, useCallback } from "react";
import { FeeBuckets } from "../FeeBuckets";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { useMessagingStore } from "../../store/messaging.store";
import { useModals } from "../../context/ModalContext";
import clsx from "clsx";
import { useUiStore } from "../../store/ui.store";

type MenuHamburgerProps = {
  address: string | undefined;
  onCloseMenu: () => void;
  onCloseWallet: () => void;
};

const MenuHamburger: FC<MenuHamburgerProps> = ({
  address,
  onCloseMenu,
  onCloseWallet,
}) => {
  const open = useUiStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const messageStore = useMessagingStore();
  const { openModal } = useModals();

  useEffect(() => {
    if (!open) {
      setActionsMenuOpen(false);
    }
  }, [open]);

  const onClearHistory = useCallback(() => {
    if (!address) return;
    if (
      confirm(
        "Are you sure you want to clear ALL message history? This will completely wipe all conversations, messages, nicknames, and handshakes. This cannot be undone."
      )
    ) {
      messageStore.flushWalletHistory(address.toString());
    }
  }, [address, messageStore]);

  if (!open) return null;

  return (
    <>
      <div
        className="absolute top-full right-0 z-10 mt-2 w-56 rounded border-1 border-gray-500 bg-[var(--primary-bg)] shadow-lg"
        onMouseLeave={onCloseMenu}
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="divide-y divide-gray-700">
          {/* Show Address Item */}
          <li
            onClick={() => {
              openModal("address");
              setSettingsOpen(false);
              onCloseMenu();
            }}
            className={clsx(
              "flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700",
              { "pointer-events-none opacity-50": !address }
            )}
          >
            <UserIcon className="h-5 w-5 text-white" />
            <span className="flex items-center text-sm text-white">
              Show Address
              {!address && (
                <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
              )}
            </span>
          </li>

          {/* Show Wallet Info Item */}
          <li
            onClick={() => {
              openModal("walletInfo");
              setSettingsOpen(false);
              onCloseMenu();
            }}
            className={clsx(
              "flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700",
              { "pointer-events-none opacity-50": !address }
            )}
          >
            <InformationCircleIcon className="h-5 w-5 text-white" />
            <span className="flex items-center text-sm text-white">
              Wallet Info
              {!address && (
                <ArrowPathIcon className="ml-2 h-5 w-5 animate-spin text-gray-500" />
              )}
            </span>
          </li>

          {/* Show Feebuckets on mobile Item */}
          <li className="block px-4 py-3 sm:hidden">
            <FeeBuckets inline={false} />
          </li>

          {/* Show Action List Sub Items */}
          <li
            className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700"
            onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
          >
            <span className="flex items-center gap-2 text-sm text-white">
              {actionsMenuOpen ? (
                <ChevronDownIcon className="h-5 w-5 text-white" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-white" />
              )}
              Actions
            </span>
          </li>

          {actionsMenuOpen && (
            <ul className="ml-2 pl-0 text-center text-sm font-semibold">
              {/* Show Fund Withdraw Item */}
              <li
                onClick={() => {
                  openModal("withdraw");
                  setActionsMenuOpen(false);
                  setSettingsOpen(false);
                  onCloseMenu();
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                <span className="text-sm text-white">Withdraw Funds</span>
              </li>
              {/* Compound messages Item */}
              <li
                onClick={() => {
                  openModal("utxo-compound");
                  setActionsMenuOpen(false);
                  onCloseMenu();
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                <span className="text-sm text-white">Compound UTXOs</span>
              </li>
              {/* Show IO messages Item */}
              {messageStore.isLoaded && (
                <li
                  onClick={() => {
                    openModal("backup");
                    setActionsMenuOpen(false);
                    setSettingsOpen(false);
                    onCloseMenu();
                  }}
                  className="cursor-pointer px-4 py-3 hover:bg-gray-700"
                >
                  <span className="text-sm text-white">
                    Import / Export <br /> Messages
                  </span>
                </li>
              )}

              {/* Show Delete All item */}
              <li
                onClick={onClearHistory}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                <span className="text-sm text-white">Delete All Messages</span>
              </li>

              {/* Show Seed extract Item */}
              <li
                onClick={() => {
                  openModal("seed");
                  setActionsMenuOpen(false);
                  setSettingsOpen(false);
                  onCloseMenu();
                }}
                className="cursor-pointer px-4 py-3 hover:bg-gray-700"
              >
                <span className="text-sm text-white">View Seed Phrase</span>
              </li>
            </ul>
          )}

          {/* Show close wallet Item */}
          <li
            onClick={onCloseWallet}
            className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-700"
          >
            <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-500">Close Wallet</span>
          </li>
        </ul>
      </div>
    </>
  );
};

export default MenuHamburger;
