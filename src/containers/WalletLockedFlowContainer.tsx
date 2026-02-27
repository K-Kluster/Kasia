import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
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
import { SeedPhraseDisplay } from "../components/WalletLockedFlow/SeedDisplay";
import { toast } from "../utils/toast-helper";

export type Step = {
  type: "home" | "create" | "import" | "unlock" | "seed" | "unlocked";
  mnemonic?: Mnemonic;
  name?: string;
  walletId?: string;
};

type WalletLockedFlowContainerProps = {
  initialStep: Step["type"];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
  isConnecting: boolean;
};

export const WalletLockedFlowContainer = ({
  initialStep,
  selectedNetwork,
  onNetworkChange,
  isConnected,
  isConnecting,
}: WalletLockedFlowContainerProps) => {
  const navigate = useNavigate();
  const { wallet } = useParams<{ wallet: string }>();
  const openModal = useUiStore((s) => s.openModal);
  const setPendingDeleteWalletId = useUiStore(
    (s) => s.setPendingDeleteWalletId
  );

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
  } = useWalletStore();

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  // select wallet from URL parameter when component mounts, needed if user routes to unlock screen
  useEffect(() => {
    if (wallet && !selectedWalletId) {
      selectWallet(wallet);
    }
  }, [wallet, selectedWalletId, selectWallet]);

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
      default:
        return;
    }
  };

  const onDeleteWallet = (walletId: string) => {
    setPendingDeleteWalletId(walletId);
    openModal("delete");
  };

  const onSelectWallet = (wallet: Wallet) => {
    selectWallet(wallet.id);
    navigate(`wallet/unlock/${wallet.id}`);
  };

  const onCreateSuccess = (walletId: string, mnemonic: Mnemonic) => {
    setStep({ type: "seed", walletId, mnemonic });
  };

  const onImportSuccess = () => {
    onStepChange("home");
    // delay toast so that toast isn't cleared
    setTimeout(() => {
      toast.success("Wallet Successfully Imported");
    }, 100);
  };

  const onUnlockSuccess = (walletId: string) => {
    onStepChange("unlocked", walletId);
  };

  const style = window.getComputedStyle(document.body);
  console.log(
    `SAT: ${style.getPropertyValue("--sat")}, ${style.getPropertyValue("--sab")}, ${style.getPropertyValue("--kb")}`
  );

  const wrapperClass = clsx(
    "w-full bg-secondary-bg overflow-x-hidden",
    isMobile
      ? [
          "fixed top-safe bottom-safe w-full max-h-screen overflow-y-auto flex flex-col p-4",
          step.type === "home" ||
          step.type === "create" ||
          step.type === "unlock"
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
          isConnecting={isConnecting}
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

      {step.type === "unlock" && (
        <Unlock
          selectedWalletId={selectedWalletId}
          wallets={wallets}
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
          isConnecting={isConnecting}
          onSuccess={onUnlockSuccess}
          onBack={() => onStepChange("home")}
        />
      )}
    </div>
  );
};
