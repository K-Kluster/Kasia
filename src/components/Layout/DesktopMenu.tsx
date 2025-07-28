import { FC, useState } from "react";
import clsx from "clsx";
import {
  PanelLeftOpen,
  Settings,
  CreditCard,
  ArrowLeft,
  User,
  Info,
  Loader2,
  Key,
  Wallet,
} from "lucide-react";
import { SettingsModal } from "../Modals/SettingsModal";
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
  isMobile,
  walletAddress,
}) => {
  const openModal = useUiStore((s) => s.openModal);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const lockWallet = useWalletStore((s) => s.lock);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
            {/* wallet */}
            <div
              className="relative"
              onMouseEnter={() =>
                !isMobile && (setWalletMenuOpen(true), setSettingsOpen(false))
              }
              onMouseLeave={() => !isMobile && setWalletMenuOpen(false)}
            >
              <button
                onClick={() => isMobile && setWalletMenuOpen((v) => !v)}
                className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 focus:outline-none"
                aria-label="Wallet Operations"
              >
                <CreditCard className="h-5 w-5" />
              </button>

              {walletMenuOpen && (
                <>
                  {/* spacer bridge */}
                  <div className="absolute bottom-full left-0 z-10 h-2 w-56" />
                  <div
                    className="border-primary-border absolute bottom-full left-0 z-10 mb-2 w-56 rounded border bg-[var(--primary-bg)] shadow-2xl shadow-(color:--button-primary)/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="divide-primary-border divide-y">
                      {/* Show Address */}
                      <li
                        onClick={() => {
                          openModal("address");
                          setWalletMenuOpen(false);
                        }}
                        className={clsx(
                          "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                          { "pointer-events-none opacity-50": !walletAddress }
                        )}
                      >
                        <User className="h-5 w-5" />
                        <span className="flex items-center text-sm">
                          Show Address
                          {!walletAddress && (
                            <Loader2 className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                          )}
                        </span>
                      </li>

                      {/* Wallet Info */}
                      <li
                        onClick={() => {
                          openModal("walletInfo");
                          setWalletMenuOpen(false);
                        }}
                        className={clsx(
                          "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                          { "pointer-events-none opacity-50": !walletAddress }
                        )}
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="flex items-center text-sm">
                          Wallet Info
                          {!walletAddress && (
                            <Loader2 className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                          )}
                        </span>
                      </li>

                      {/* Withdraw */}
                      <li
                        onClick={() => {
                          openModal("withdraw");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm">Withdraw Funds</span>
                      </li>

                      {/* Compound */}
                      <li
                        onClick={() => {
                          openModal("utxo-compound");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm">Compound UTXOs</span>
                      </li>

                      {/* Seed */}
                      <li
                        onClick={() => {
                          openModal("seed");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Key className="h-5 w-5" />
                        <span className="text-sm">View Seed Phrase</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 focus:outline-none"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
              />
            </div>

            {/* toggle pane */}
            <button
              aria-label="toggle contacts pane"
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 transition-colors"
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
              className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 transition-colors"
              onClick={() => setContactsCollapsed(!contactsCollapsed)}
            >
              <PanelLeftOpen className="size-5" />
            </button>

            {/* settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 focus:outline-none"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
              />
            </div>

            {/* wallet */}
            <div
              className="relative"
              onMouseEnter={() =>
                !isMobile && (setWalletMenuOpen(true), setSettingsOpen(false))
              }
              onMouseLeave={() => !isMobile && setWalletMenuOpen(false)}
            >
              <button
                onClick={() => isMobile && setWalletMenuOpen((v) => !v)}
                className="hover:bg-primary-bg/50 cursor-pointer rounded p-2 focus:outline-none"
                aria-label="Wallet Operations"
              >
                <CreditCard className="h-5 w-5" />
              </button>

              {walletMenuOpen && (
                <>
                  {/* spacer bridge */}
                  <div className="absolute bottom-full left-0 z-10 h-2 w-56" />
                  <div
                    className="border-primary-border absolute bottom-full left-0 z-10 mb-2 w-56 rounded border bg-[var(--primary-bg)] shadow-2xl shadow-(color:--button-primary)/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="divide-primary-border divide-y">
                      {/* Show Address */}
                      <li
                        onClick={() => {
                          openModal("address");
                          setWalletMenuOpen(false);
                        }}
                        className={clsx(
                          "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                          { "pointer-events-none opacity-50": !walletAddress }
                        )}
                      >
                        <User className="h-5 w-5" />
                        <span className="flex items-center text-sm">
                          Show Address
                          {!walletAddress && (
                            <Loader2 className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                          )}
                        </span>
                      </li>

                      {/* Wallet Info */}
                      <li
                        onClick={() => {
                          openModal("walletInfo");
                          setWalletMenuOpen(false);
                        }}
                        className={clsx(
                          "hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3",
                          { "pointer-events-none opacity-50": !walletAddress }
                        )}
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="flex items-center text-sm">
                          Wallet Info
                          {!walletAddress && (
                            <Loader2 className="ml-2 h-5 w-5 animate-spin text-gray-500" />
                          )}
                        </span>
                      </li>

                      {/* Withdraw */}
                      <li
                        onClick={() => {
                          openModal("withdraw");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm">Withdraw Funds</span>
                      </li>

                      {/* Compound */}
                      <li
                        onClick={() => {
                          openModal("utxo-compound");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm">Compound UTXOs</span>
                      </li>

                      {/* Seed */}
                      <li
                        onClick={() => {
                          openModal("seed");
                          setWalletMenuOpen(false);
                        }}
                        className="hover:bg-secondary-bg flex cursor-pointer items-center gap-2 px-4 py-3"
                      >
                        <Key className="h-5 w-5" />
                        <span className="text-sm">View Seed Phrase</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
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
            "hover:bg-primary-bg/50 flex w-full cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:outline-none",
            contactsCollapsed ? "flex-col" : "flex-row"
          )}
          aria-label="Sign out"
        >
          <ArrowLeft className="h-5 w-5 text-red-500" />
          {!contactsCollapsed && (
            <span className="text-sm text-red-500">Sign out</span>
          )}
        </button>
      </div>
    </div>
  );
};
