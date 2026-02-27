import { FC } from "react";
import clsx from "clsx";
import { PanelLeftOpen, Settings, ArrowLeft, User, Wallet } from "lucide-react";
import { useUiStore } from "../../store/ui.store";
import { useWalletStore } from "../../store/wallet.store";

interface DesktopMenuProps {
  contactsCollapsed: boolean;
  setContactsCollapsed: (v: boolean) => void;
  isMobile: boolean;
  walletAddress: string | undefined;
}

export const DesktopMenu: FC<DesktopMenuProps> = ({
  contactsCollapsed,
  setContactsCollapsed,
  walletAddress,
}) => {
  const openModal = useUiStore((s) => s.openModal);
  const lockWallet = useWalletStore((s) => s.lock);

  return (
    <div className="border-primary-border bg-secondary-bg border-t p-2 select-none">
      <div
        className={clsx(
          "flex gap-2",
          contactsCollapsed ? "flex-col items-center" : "flex-row items-center"
        )}
      >
        {contactsCollapsed ? (
          <>
            {/* address */}
            <button
              onClick={() => openModal("address")}
              disabled={!walletAddress}
              className={clsx(
                "hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80",
                { "pointer-events-none opacity-50": !walletAddress }
              )}
              aria-label="Show Address"
            >
              <User className="h-5 w-5" />
            </button>

            {/* wallet */}
            <button
              onClick={() => openModal("walletInfo")}
              disabled={!walletAddress}
              className={clsx(
                "hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80",
                { "pointer-events-none opacity-50": !walletAddress }
              )}
              aria-label="Wallet Info"
            >
              <Wallet className="h-5 w-5" />
            </button>

            {/* settings */}
            <button
              onClick={() => openModal("settings-unlocked")}
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* toggle pane */}
            <button
              aria-label="toggle contacts pane"
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] active:scale-90 active:opacity-80"
              onClick={() => setContactsCollapsed(!contactsCollapsed)}
            >
              <PanelLeftOpen
                className={clsx("size-5", contactsCollapsed && "rotate-180")}
              />
            </button>
          </>
        ) : (
          <>
            {/* toggle pane */}
            <button
              aria-label="toggle contacts pane"
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] active:scale-90 active:opacity-80"
              onClick={() => setContactsCollapsed(!contactsCollapsed)}
            >
              <PanelLeftOpen className="size-5" />
            </button>

            {/* settings */}
            <button
              onClick={() => openModal("settings-unlocked")}
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* wallet */}
            <button
              onClick={() => openModal("walletInfo")}
              disabled={!walletAddress}
              className={clsx(
                "hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80",
                { "pointer-events-none opacity-50": !walletAddress }
              )}
              aria-label="Wallet Info"
            >
              <Wallet className="h-5 w-5" />
            </button>

            {/* address */}
            <button
              onClick={() => openModal("address")}
              disabled={!walletAddress}
              className={clsx(
                "hover:bg-primary-bg/50 cursor-pointer rounded p-2 hover:text-[var(--kas-primary)] focus:outline-none active:scale-90 active:opacity-80",
                { "pointer-events-none opacity-50": !walletAddress }
              )}
              aria-label="Show Address"
            >
              <User className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* sign-out row */}
      <div
        className={clsx(
          "mt-2",
          contactsCollapsed ? "flex justify-center" : "flex items-center"
        )}
      >
        <button
          onClick={lockWallet}
          className={clsx(
            "hover:bg-primary-bg/50 flex w-full cursor-pointer items-center gap-2 rounded p-2 focus:outline-none active:scale-90 active:opacity-80",
            contactsCollapsed ? "flex-col" : "flex-row"
          )}
          aria-label="Sign out"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--accent-red)]" />
          {!contactsCollapsed && (
            <span className="text-sm text-[var(--accent-red)]">Sign out</span>
          )}
        </button>
      </div>
    </div>
  );
};
