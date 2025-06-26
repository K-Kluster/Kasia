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
        className="absolute right-0 top-full mt-2 w-56 bg-[var(--primary-bg)] border-1 border-gray-500 rounded shadow-lg z-10"
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
              "flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer",
              { "opacity-50 pointer-events-none": !address }
            )}
          >
            <UserIcon className="h-5 w-5 text-white" />
            <span className="text-white text-sm flex items-center">
              Show Address
              {!address && (
                <ArrowPathIcon className="animate-spin h-5 w-5 text-gray-500 ml-2" />
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
              "flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer",
              { "opacity-50 pointer-events-none": !address }
            )}
          >
            <InformationCircleIcon className="h-5 w-5 text-white" />
            <span className="text-white text-sm flex items-center">
              Wallet Info
              {!address && (
                <ArrowPathIcon className="animate-spin h-5 w-5 text-gray-500 ml-2" />
              )}
            </span>
          </li>

          {/* Show Feebuckets on mobile Item */}
          <li className="block sm:hidden px-4 py-3">
            <FeeBuckets inline={false} />
          </li>

          {/* Show Action List Sub Items */}
          <li
            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
            onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
          >
            <span className="text-white text-sm flex items-center gap-2">
              {actionsMenuOpen ? (
                <ChevronDownIcon className="h-5 w-5 text-white" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-white" />
              )}
              Actions
            </span>
          </li>

          {actionsMenuOpen && (
            <ul className="pl-0 text-sm font-semibold text-center ml-2">
              {/* Show Fund Withdraw Item */}
              <li
                onClick={() => {
                  openModal("withdraw");
                  setActionsMenuOpen(false);
                  setSettingsOpen(false);
                  onCloseMenu();
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">Withdraw Funds</span>
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
                  className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
                >
                  <span className="text-white text-sm">
                    Import / Export <br /> Messages
                  </span>
                </li>
              )}

              {/* Show Delete All item */}
              <li
                onClick={onClearHistory}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">Delete All Messages</span>
              </li>

              {/* Show Seed extract Item */}
              <li
                onClick={() => {
                  openModal("seed");
                  setActionsMenuOpen(false);
                  setSettingsOpen(false);
                  onCloseMenu();
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">View Seed Phrase</span>
              </li>
            </ul>
          )}

          {/* Show close wallet Item */}
          <li
            onClick={onCloseWallet}
            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
          >
            <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
            <span className="text-red-500 text-sm">Close Wallet</span>
          </li>
        </ul>
      </div>
    </>
  );
};

export default MenuHamburger;
