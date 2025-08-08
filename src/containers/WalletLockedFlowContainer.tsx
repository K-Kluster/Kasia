import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mnemonic } from "kaspa-wasm";
import { useWalletStore } from "../store/wallet.store";
import { useUiStore } from "../store/ui.store";
import { useIsMobile } from "../hooks/useIsMobile";
import clsx from "clsx";
import { NetworkType } from "../types/all";
import { Wallet } from "../types/wallet.type";

import { CreateWallet } from "../components/WalletLockedFlow/Create";
import { Home } from "../components/WalletLockedFlow/Home";
import { Import } from "../components/WalletLockedFlow/Import";
import { Unlock } from "../components/WalletLockedFlow/Unlock";
import { Migrate } from "../components/WalletLockedFlow/Migrate";
import { Unlocked } from "../components/WalletLockedFlow/Unlocked";
import { SeedPhraseDisplay } from "../components/WalletLockedFlow/SeedDisplay";

export type Step = {
  type:
    | "home"
    | "create"
    | "import"
    | "unlock"
    | "migrate"
    | "seed"
    | "success"
    | "unlocked";
  mnemonic?: Mnemonic;
  name?: string;
  walletId?: string;
};

type WalletLockedFlowContainerProps = {
  initialStep: Step["type"];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
};

export const WalletLockedFlowContainer = ({
  initialStep,
  selectedNetwork,
  onNetworkChange,
  isConnected,
}: WalletLockedFlowContainerProps) => {
  const navigate = useNavigate();
  const { wallet } = useParams<{ wallet: string }>();
  const openModal = useUiStore((s) => s.openModal);

  const isMobile = useIsMobile();

  const [step, setStep] = useState<Step>({
    type: initialStep as Step["type"],
    walletId: wallet,
  });

  const {
    wallets,
    selectedWalletId,
    unlockedWallet,
    loadWallets,
    selectWallet,
    deleteWallet,
  } = useWalletStore();

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  // ref for scroll up when step changes, like a page reset
  const containerRef = useRef<HTMLDivElement>(null);

  // scroll to top instantly on step change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [step.type]);

  const onStepChange = (type: Step["type"], walletId?: string) => {
    if (unlockedWallet) return;
    switch (type) {
      case "home":
        navigate("/");
        break;
      case "create":
        navigate("/wallet/create");
        break;
      case "import":
        navigate("/wallet/import");
        break;
      case "unlock":
        navigate(`/wallet/unlock/${walletId ?? ""}`);
        break;
      case "migrate":
        navigate(`/wallet/migrate/${walletId ?? ""}`);
        break;
      default:
        return;
    }
  };

  const onDeleteWallet = (walletId: string) => {
    if (window.confirm("Are you sure you want to delete this wallet?")) {
      deleteWallet(walletId);
    }
  };

  const onSelectWallet = (wallet: Wallet) => {
    selectWallet(wallet.id);
    navigate(`wallet/unlock/${wallet.id}`);
  };

  const onCreateSuccess = (walletId: string, mnemonic: Mnemonic) => {
    setStep({ type: "seed", walletId, mnemonic });
  };

  const onImportSuccess = () => {
    setStep({ type: "success" });
  };

  const onUnlockSuccess = (walletId: string) => {
    onStepChange("unlocked", walletId);
  };

  const onMigrateSuccess = () => {
    navigate("/");
  };

  const wrapperClass = clsx(
    "w-full bg-secondary-bg overflow-x-hidden",
    isMobile
      ? [
          "fixed inset-0 w-full max-h-screen overflow-y-auto flex flex-col p-4",
          (step.type === "home" && wallets.length <= 2) ||
          step.type === "success" ||
          step.type === "create"
            ? "justify-center"
            : "justify-start",
        ]
      : [
          "mx-auto my-8 rounded-2xl max-w-[700px] border border-primary-border p-8",
          step.type === "home" && "relative",
        ]
  );

  return (
    <div ref={containerRef} className={wrapperClass}>
      {step.type === "home" && (
        <Home
          wallets={wallets}
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
          onSelectWallet={onSelectWallet}
          onDeleteWallet={onDeleteWallet}
          onStepChange={onStepChange}
          openModal={openModal}
          isMobile={isMobile}
        />
      )}

      {step.type === "create" && (
        <CreateWallet
          onSuccess={onCreateSuccess}
          onBack={() => onStepChange("home")}
        />
      )}

      {step.type === "seed" && step.mnemonic && (
        <SeedPhraseDisplay
          mnemonic={step.mnemonic}
          onBack={() => {
            setStep({ type: "home", mnemonic: undefined });
            onStepChange("home");
          }}
        />
      )}

      {step.type === "import" && (
        <Import
          onSuccess={onImportSuccess}
          onBack={() => onStepChange("home")}
        />
      )}

      {step.type === "success" && (
        <Unlocked onBack={() => onStepChange("home")} />
      )}

      {step.type === "migrate" && (
        <Migrate
          walletId={step.walletId}
          wallets={wallets}
          onSuccess={onMigrateSuccess}
          onBack={() => onStepChange("home")}
        />
      )}

      {step.type === "unlock" && (
        <Unlock
          selectedWalletId={selectedWalletId}
          wallets={wallets}
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
          onSuccess={onUnlockSuccess}
          onBack={() => onStepChange("home")}
        />
      )}
    </div>
  );
};
