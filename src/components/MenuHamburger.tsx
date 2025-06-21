import { FC } from "react";
import {
  InformationCircleIcon,
  ArrowLongLeftIcon,
} from "@heroicons/react/24/solid";

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
  if (!open) return null;

  return (
    <div
      className="absolute right-0 top-full mt-2 w-56 bg-[var(--primary-bg)] border border-gray-700 rounded shadow-lg z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <ul className="divide-y divide-gray-700">
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
          onClick={onCloseWallet}
          className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 cursor-pointer"
        >
          <ArrowLongLeftIcon className="h-5 w-5 text-red-500" />
          <span className="text-red-500 text-sm">Close Wallet</span>
        </li>
      </ul>
    </div>
  );
};

export default MenuHamburger;
