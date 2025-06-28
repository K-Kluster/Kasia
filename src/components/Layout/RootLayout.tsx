import { FC, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store/wallet.store";
import { useIsMobile } from "../../utils/useIsMobile";
import { Header } from "../Layout/Header";
import { SlideOutMenu } from "../Layout/SlideOutMenu";
import { ModalProvider } from "../../context/ModalContext";
import { ToastContainer } from "../Common/ToastContainer";
import { useUiStore } from "../../store/ui.store";

export const RootLayout: FC = () => {
  const walletStore = useWalletStore();
  const uiStore = useUiStore();

  const isWalletReady = Boolean(walletStore.unlockedWallet);
  const isMobile = useIsMobile();

  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleCloseWallet = () => {
    // close settings panel
    uiStore.setSettingsOpen(false);

    // navigate home
    navigate("/");
  };

  return (
    <ModalProvider>
      <ToastContainer />

      {/* desktop header */}
      {!isMobile && (
        <Header
          isWalletReady={isWalletReady}
          walletAddress={walletStore.address?.toString()}
          menuRef={menuRef}
          onCloseWallet={handleCloseWallet}
        />
      )}

      {/* mobile drawer */}
      {isMobile && (
        <SlideOutMenu
          isWalletReady={isWalletReady}
          address={walletStore.address?.toString()}
          onCloseWallet={handleCloseWallet}
        />
      )}

      <Outlet />
    </ModalProvider>
  );
};
