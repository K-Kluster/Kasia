import { FC } from "react";
import { ThemeToggle } from "../Common/ThemeToggle";

type Props = {
  isWalletReady: boolean;
  walletAddress?: string;
  onCloseWallet: () => void;
};

export const Header: FC<Props> = () => {
  return (
    <div className="border-primary-border flex items-center justify-between border-b bg-[var(--secondary-bg)] px-8 py-1 text-center select-none">
      <div className="flex items-center gap-2">
        <img
          src="/kasia-logo.png"
          alt="Kasia Logo"
          className="-mr-6 h-[60px] w-[60px] object-contain select-none"
        />
        <div className="ml-3 text-2xl font-semibold text-[var(--text-primary)]">
          Kasia
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </div>
  );
};
