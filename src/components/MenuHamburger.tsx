import { FC, useState, useEffect } from "react";
import { FeeBuckets } from "./FeeBuckets";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";
import { WalletSeedRetreiveDisplay } from "../containers/WalletSeedRetreiveDisplay";
import { WalletWithdrawal } from "../containers/WalletWithdrawal";
import { MessageBackup } from "./Messagebackup";
import { UtxoCompound } from "./UtxoCompound";

type WalletSettingsProps = {
  open: boolean;
  onCloseMenu: () => void;
  onOpenWalletInfo: () => void;
  onCloseWallet: () => void;
  messageStoreLoaded: boolean;
};

const MenuHamburger: FC<WalletSettingsProps> = ({
  open,
  onCloseMenu,
  onOpenWalletInfo,
  onCloseWallet,
  messageStoreLoaded,
}) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [showSeedRetrieveModal, setShowSeedRetrieveModal] = useState(false);
  const [showWalletWithdrawal, setShowWalletWithdrawal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showUtxoCompound, setShowUtxoCompound] = useState(false);

  useEffect(() => {
    if (!open) {
      setActionsMenuOpen(false);
      setShowWalletWithdrawal(false);
      setShowSeedRetrieveModal(false);
      setShowMessageModal(false);
      setShowUtxoCompound(false);
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
          <li className="block sm:hidden px-4 py-3">
            <FeeBuckets inline={false} />
          </li>
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
              <li
                onClick={() => {
                  setShowWalletWithdrawal(true);
                  setActionsMenuOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">Withdraw Funds</span>
              </li>
              <li
                onClick={() => {
                  setShowUtxoCompound(true);
                  setActionsMenuOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">Compound UTXOs</span>
              </li>
              <li
                onClick={() => {
                  setShowSeedRetrieveModal(true);
                  setActionsMenuOpen(false);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">View Seed Phrase</span>
              </li>
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
          <li
            onClick={onCloseWallet}
            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
          >
            <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
            <span className="text-red-500 text-sm">Close Wallet</span>
          </li>
        </ul>
      </div>

      {/* UTXO Compound Modal */}
      {showUtxoCompound && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20"
          onClick={() => setShowUtxoCompound(false)}
        >
          <div
            className="bg-[var(--secondary-bg)] p-6 rounded-lg w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUtxoCompound(false)}
              className="absolute top-2 right-2 text-gray-200 hover:text-white p-2 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <UtxoCompound />
          </div>
        </div>
      )}

      {/* Export/Import Messages Modal */}
      {showMessageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20"
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

      {/* Show wallet address modal */}
      {showWalletWithdrawal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20"
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
    </>
  );
};

export default MenuHamburger;
