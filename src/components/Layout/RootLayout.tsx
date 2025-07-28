import { FC, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useWalletStore } from "../../store/wallet.store";
import { useIsMobile } from "../../utils/useIsMobile";
import { Header } from "../Layout/Header";
import { SlideOutMenu } from "../Layout/SlideOutMenu";

import { ToastContainer } from "../Common/ToastContainer";
import { useUiStore } from "../../store/ui.store";
import { toast } from "../../utils/toast";
import { ResizableAppContainer } from "./ResizableAppContainer";

export const RootLayout: FC = () => {
  const walletStore = useWalletStore();
  const uiStore = useUiStore();

  const isWalletReady = Boolean(walletStore.unlockedWallet);
  const isMobile = useIsMobile();

  const navigate = useNavigate();
  const location = useLocation();

  const handleCloseWallet = () => {
    // close settings panel
    uiStore.setSettingsOpen(false);

    // navigate home
    navigate("/");
  };

  // when navigation changes, remove ALL toast notifications
  useEffect(() => {
    toast.removeAll();
  }, [location]);

  return (
    <>
      <ToastContainer />
      <ResizableAppContainer>
        {/* desktop header */}
        {!isMobile && (
          <Header
            isWalletReady={isWalletReady}
            walletAddress={walletStore.address?.toString()}
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
      </ResizableAppContainer>
    </>
  );
};
