import { FC, useState, useEffect } from "react";
import { FeeBuckets } from "./FeeBuckets";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
  StarIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import { WalletSeedRetreiveDisplay } from "../containers/WalletSeedRetreiveDisplay";

type WalletSettingsProps = {
  open: boolean;
  onCloseMenu: () => void;
  onOpenWalletInfo: () => void;
  onCloseWallet: () => void;
};

const MenuHamburger: FC<WalletSettingsProps> = ({
  open,
  onCloseMenu,
  onOpenWalletInfo,
  onCloseWallet,
}) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [showSeedRetrieveModal, setShowSeedRetrieveModal] = useState(false);

  // Close the sub menu when we close the hamburger
  useEffect(() => {
    if (!open) {
      setActionsMenuOpen(false);
    }
  }, [open]);
  
  if (!open) return null;

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
              <StarIcon className="h-5 w-5 text-white" />
              Actions
            </span>
          </li>

          {/* Items inside actions submenu */}
          {actionsMenuOpen && (
            <ul className="pl-0 text-sm font-semibold">
              <li
                onClick={() => {
                  setShowSeedRetrieveModal(true);
                }}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer"
              >
                <span className="text-white text-sm">View Seed Phrase</span>
              </li>
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

      {/* Modal for getting your seed */}
      {showSeedRetrieveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-center z-20"
          onClick={() => setShowSeedRetrieveModal(false)}
        >
          <div
            className="bg-[var(--primary-bg)] p-6 rounded-lg w-96 flex flex-col items-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button (X) at the top-right */}
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
    </>
  );
};

export default MenuHamburger;
