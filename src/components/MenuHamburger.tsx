import { FC, useState, useEffect } from "react";
import { FeeBuckets } from "./FeeBuckets";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { WalletSeedRetreiveDisplay } from "../containers/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../containers/WalletWithdrawal";
import { MessageBackup } from "./MessageBackup";
import { WalletAddressSection } from "./WalletAddressSection";
import clsx from "clsx";

type WalletSettingsProps = {
  open: boolean;
  address: string | undefined;
  onCloseMenu: () => void;
  onOpenWalletInfo: () => void;
  onCloseWallet: () => void;
  messageStoreLoaded: boolean;
};

const MenuHamburger: FC<WalletSettingsProps> = ({
  open,
  address,
  onCloseMenu,
  onOpenWalletInfo,
  onCloseWallet,
  messageStoreLoaded,
}) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [showSeedRetrieveModal, setShowSeedRetrieveModal] = useState(false);
  const [showWalletWithdrawal, setShowWalletWithdrawal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    if (!open) {
      setActionsMenuOpen(false);
      setShowWalletWithdrawal(false);
      setShowSeedRetrieveModal(false);
      setShowMessageModal(false);
    }
  }, [open]);

  if (!open) return null;

  const handleExportClick = () => {
    setShowMessageModal(true);
  };

  return (
    <>
      <div
        className="absolute right-0 top-full mt-2 w-56 bg-[var(--primary-bg)] border-1 border-gray-500 rounded shadow-lg z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="divide-y divide-gray-700">
          {/* Show Address Item */}
          <li
            onClick={() => setShowAddressModal(true)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer",
              { "opacity-50 pointer-events-none": !address }
            )}
          >
            <UserIcon className="h-5 w-5 text-white" />
            <span className="text-white text-sm flex items-center">
              Show Address
              {address === "" || address === undefined ? (
                <ArrowPathIcon className="animate-spin h-5 w-5 text-gray-500 ml-2" />
              ) : null}
            </span>
          </li>
          {/* Show Wallet Info Item */}
          <li
            onClick={() => {
              onOpenWalletInfo();
              onCloseMenu();
            }}
            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
          >
            <InformationCircleIcon className="h-5 w-5 text-white" />
            <span className="text-white text-sm">Wallet Info</span>
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
            <ul className="pl-0 text-sm font-semibold text-left ml-2">
              {/* Show Fund Withdraw Item */}
              <li
                onClick={() => {
                  setShowWalletWithdrawal(true);
                  setActionsMenuOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">Withdraw Funds</span>
              </li>
              {/* Show Seed extract Item */}
              <li
                onClick={() => {
                  setShowSeedRetrieveModal(true);
                  setActionsMenuOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">View Seed Phrase</span>
              </li>
              {/* Show IO messages Item */}
              {messageStoreLoaded && (
                <li
                  onClick={handleExportClick}
                  className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
                >
                  <span className="text-white text-sm">
                    Import / Export <br /> Messages
                  </span>
                </li>
              )}
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

      {/* Export/Import Messages Modal */}
      {showMessageModal && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-center z-20"
          onClick={() => setShowMessageModal(false)}
        >
          <div
            className="bg-[var(--primary-bg)] p-6 rounded-lg w-96 flex flex-col items-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMessageModal(false)}
              className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <MessageBackup />
          </div>
        </div>
      )}

      {/* Seed and Withdrawal Modal */}
      {showSeedRetrieveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-center z-20"
          onClick={() => setShowSeedRetrieveModal(false)}
        >
          <div
            className="bg-[var(--primary-bg)] p-6 rounded-lg w-96 flex flex-col items-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSeedRetrieveModal(false)}
              className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <WalletSeedRetreiveDisplay />
          </div>
        </div>
      )}

      {/* Show wallet withdraw modal */}
      {showWalletWithdrawal && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-center z-20"
          onClick={() => setShowWalletWithdrawal(false)}
        >
          <div
            className="bg-[var(--primary-bg)] p-6 rounded-lg w-96 flex flex-col items-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWalletWithdrawal(false)}
              className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <WalletWithdrawal />
          </div>
        </div>
      )}

      {/* Show wallet address modal */}
      {showAddressModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
          onClick={() => setShowAddressModal(false)}
        >
          <div
            className="bg-[var(--secondary-bg)] p-6 rounded-xl relative max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto border border-[var(--border-color)] animate-[modalFadeIn_0.3s_ease-out] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button (X) at the top-right */}
            <button
              onClick={() => setShowAddressModal(false)}
              className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            <div className="my-2 flex-grow">
              <WalletAddressSection address={address} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MenuHamburger;
