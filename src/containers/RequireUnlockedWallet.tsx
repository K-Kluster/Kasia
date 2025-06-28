import { FC } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useWalletStore } from "../store/wallet.store";

// Guard to prevent people from navigating to the wallet w/its id (or trying to)
export const RequireUnlockedWallet: FC = () => {
  const { walletId } = useParams<{ walletId: string }>();
  const unlocked = useWalletStore((s) => s.unlockedWallet);

  if (!unlocked || unlocked.id !== walletId) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
