import { FC } from "react";
import { Bars3Icon } from "@heroicons/react/24/solid";
import MenuHamburger from "./HamburgerMenu";
import { FeeBuckets } from "../FeeBuckets";
import { useUiStore } from "../../store/ui.store";

type Props = {
  isWalletReady: boolean;
  walletAddress?: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCloseWallet: () => void;
};

export const Header: FC<Props> = ({
  isWalletReady,
  walletAddress,
  menuRef,
  onCloseWallet,
}) => {
  const toggleSettings = useUiStore((s) => s.toggleSettings);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <div className="text-center px-8 py-1 border-b border-[var(--border-color)] relative flex items-center justify-between bg-[var(--secondary-bg)]">
      <div className="flex items-center gap-2">
        <img
          src="/kasia-logo.png"
          alt="Kasia Logo"
          className="w-[60px] h-[60px] object-contain -mr-6"
        />
        <div className="ml-4 text-2xl font-semibold text-[var(--text-primary)]">
          Kasia
        </div>
      </div>

      {isWalletReady && (
        <div ref={menuRef} className="relative flex items-center gap-2 group">
          <div className="opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
            <FeeBuckets inline />
          </div>

          <button
            onClick={toggleSettings}
            className="p-2 rounded hover:bg-[var(--accent-blue)]/20 focus:outline-none"
            aria-label="Settings"
          >
            <Bars3Icon className="h-8 w-8 text-kas-primary animate-pulse" />
          </button>

          <MenuHamburger
            address={walletAddress}
            onCloseMenu={() => setSettingsOpen(false)}
            onCloseWallet={onCloseWallet}
          />
        </div>
      )}
    </div>
  );
};
