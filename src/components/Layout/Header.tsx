import { FC } from "react";
import { Bars3Icon } from "@heroicons/react/24/solid";
import MenuHamburger from "../MenuHamburger";
import { WalletInfo } from "../WalletInfo";
import { FeeBuckets } from "../FeeBuckets";
import { useMessagingStore } from "src/store/messaging.store";

type Props = {
  isWalletReady: boolean;
  walletAddress?: string;
  isSettingsOpen: boolean;
  isWalletInfoOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  toggleSettings: () => void;
  onCloseWallet: () => void;
  setIsWalletInfoOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
};

export const Header: FC<Props> = ({
  isWalletReady,
  walletAddress,
  isSettingsOpen,
  isWalletInfoOpen,
  menuRef,
  toggleSettings,
  onCloseWallet,
  setIsWalletInfoOpen,
  setIsSettingsOpen,
}) => {
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
        <div ref={menuRef} className="relative flex items-center gap-2">
          <div className="hidden sm:block">
            <FeeBuckets inline={true} />
          </div>

          <button
            onClick={toggleSettings}
            className="p-2 rounded hover:bg-[var(--accent-blue)]/20 focus:outline-none"
            aria-label="Settings"
          >
            <Bars3Icon className="h-8 w-8 text-kas-primary animate-pulse" />
          </button>

          {!isWalletInfoOpen ? (
            <MenuHamburger
              open={isSettingsOpen}
              address={walletAddress}
              onCloseMenu={() => setIsSettingsOpen(false)}
              onOpenWalletInfo={() => {
                setIsWalletInfoOpen(true);
                setIsSettingsOpen(false);
              }}
              onCloseWallet={onCloseWallet}
            />
          ) : (
            <WalletInfo
              state={walletAddress ? "connected" : "loading"}
              address={walletAddress}
              isWalletReady={isWalletReady}
              open={isWalletInfoOpen}
              onClose={() => setIsWalletInfoOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
