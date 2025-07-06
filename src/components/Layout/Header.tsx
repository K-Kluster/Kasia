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
    <div className="relative flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--secondary-bg)] px-8 py-1 text-center">
      <div className="flex items-center gap-2">
        <img
          src="/kasia-logo.png"
          alt="Kasia Logo"
          className="-mr-6 h-[60px] w-[60px] object-contain"
        />
        <div className="ml-3 text-2xl font-semibold text-[var(--text-primary)]">
          Kasia
        </div>
      </div>

      {isWalletReady && (
        <div ref={menuRef} className="group relative flex items-center gap-2">
          <div className="scale-95 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            <FeeBuckets inline />
          </div>

          <button
            onClick={toggleSettings}
            className="rounded p-2 hover:bg-[var(--accent-blue)]/20 focus:outline-none"
            aria-label="Settings"
          >
            <Bars3Icon className="text-kas-primary h-8 w-8 animate-pulse" />
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
