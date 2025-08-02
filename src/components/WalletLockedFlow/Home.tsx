import { Settings, Trash2 } from "lucide-react";
import { NetworkSelector } from "../NetworkSelector";
import { TrustMessage } from "../Layout/TrustMessage";
import { Button } from "../Common/Button";
import { Wallet } from "../../types/wallet.type";
import { NetworkType } from "../../types/all";
import { ModalType } from "../../store/ui.store";
import clsx from "clsx";

type HomeProps = {
  wallets: Wallet[];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
  onSelectWallet: (wallet: Wallet) => void;
  onDeleteWallet: (walletId: string) => void;
  onStepChange: (
    type:
      | "home"
      | "create"
      | "import"
      | "unlock"
      | "migrate"
      | "seed"
      | "success"
      | "unlocked",
    walletId?: string
  ) => void;
  openModal: (modal: ModalType) => void;
  isMobile: boolean;
};

export const Home = ({
  wallets,
  selectedNetwork,
  onNetworkChange,
  isConnected,
  onSelectWallet,
  onDeleteWallet,
  onStepChange,
  openModal,
  isMobile,
}: HomeProps) => {
  return (
    <>
      <button
        onClick={() => openModal("settings")}
        className="absolute top-4 right-4 size-6 hover:cursor-pointer hover:opacity-80"
      >
        <Settings className="size-6" />
      </button>
      <div
        className={clsx(
          "mb-1 flex items-center justify-center",
          isMobile ? "grow-0" : "grow"
        )}
      >
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
      </div>
      <TrustMessage />
      <h2 className="text-text-primary mt-2 mb-2 text-center text-xl font-semibold sm:mt-2 sm:mb-3 sm:text-2xl">
        {wallets.length <= 0 ? "No Wallets Found" : "Select Wallet"}
      </h2>
      <div className="mb-3 flex flex-col gap-2 overflow-y-auto sm:gap-4">
        {wallets.map((w) => (
          <div
            key={w.id}
            onClick={() => onSelectWallet(w)}
            className="hover:border-kas-secondary border-primary-border relative flex cursor-pointer flex-col items-start gap-2 rounded-lg border bg-[var(--primary-bg)] p-4 hover:bg-[var(--primary-bg)]/50 sm:flex-row sm:items-center sm:justify-between"
          >
            {/* delete icon top-right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteWallet(w.id);
              }}
              className="absolute top-2 right-2 cursor-pointer rounded-md bg-[var(--accent-red)]/10 p-[2px] text-[var(--accent-red)]/50 hover:scale-110"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <div className="flex w-full flex-col gap-1">
              <div className="font-semibold text-[var(--text-primary)]">
                <span>{w.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span>
                  Created: {new Date(w.createdAt).toLocaleDateString()}
                </span>
                <div className="ml-2">
                  {w.derivationType === "standard" ? (
                    <span
                      className={clsx({
                        "bg-kas-secondary/20 border-kas-secondary rounded-3xl border px-2 py-1 text-xs font-medium": true,
                      })}
                      title="Kaspium Compatible"
                    >
                      Standard
                    </span>
                  ) : (
                    <span className="rounded bg-amber-400 px-2 py-1 text-xs font-medium text-[var(--text-primary)]">
                      Legacy
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                {w.derivationType === "legacy" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepChange("migrate", w.id);
                    }}
                    className="bg-kas-secondary/20 hover:bg-kas-secondary/50 animate-pulse cursor-pointer rounded px-2 py-1 text-xs transition-colors duration-200"
                    title="Migrate to standard derivation"
                  >
                    Migrate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
        <Button variant="primary" onClick={() => onStepChange("create")}>
          Create New Wallet
        </Button>
        <Button variant="secondary" onClick={() => onStepChange("import")}>
          Import Wallet
        </Button>
      </div>
    </>
  );
};
