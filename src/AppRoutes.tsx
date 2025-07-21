import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./components/Layout/RootLayout";
import { WalletFlow } from "./containers/WalletFlow";
import { RequireUnlockedWallet } from "./containers/RequireUnlockedWallet";
import { ModalDisplay } from "./containers/ModalDisplay";

import type { NetworkType } from "./types/all";
import type { Step } from "./containers/WalletFlow";
import { useWalletStore } from "./store/wallet.store";
import { MessengerContainer } from "./containers/MessengerContainer";
import { useDBStore } from "./store/db.store";

type WalletFlowRouteConfig = {
  path: string | undefined;
  initialStep: Step["type"];
};

const walletFlowRoutes: WalletFlowRouteConfig[] = [
  { path: "create", initialStep: "create" },
  { path: "import", initialStep: "import" },
  { path: "unlock/:wallet", initialStep: "unlock" },
  { path: "migrate/:wallet", initialStep: "migrate" },
];

export type AppRoutesProps = {
  network: NetworkType;
  isConnected: boolean;
  onNetworkChange: (n: NetworkType) => void;
};

export const AppRoutes: React.FC<AppRoutesProps> = ({
  network,
  isConnected,
  onNetworkChange,
}) => {
  const { unlockedWallet, selectedWalletId } = useWalletStore();
  const { db, initRepositories, repositories } = useDBStore();

  useEffect(() => {
    if (unlockedWallet && db) {
      initRepositories(unlockedWallet.id, unlockedWallet.password);
    }
  }, [unlockedWallet, db, selectedWalletId, initRepositories]);

  // @TODO(indexdb): style this, should take long
  if (unlockedWallet && !db && !repositories) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* Home */}
        <Route
          index
          element={
            <WalletFlow
              initialStep="home"
              selectedNetwork={network}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
            />
          }
        />

        <Route path="wallet">
          {/* index for /wallet */}
          <Route index element={<Navigate to="/" replace />} />
          {walletFlowRoutes.map(({ path, initialStep }) => (
            <Route
              key={path!}
              path={path!}
              element={
                initialStep === "unlock" &&
                unlockedWallet &&
                selectedWalletId ? (
                  <Navigate to={`/${selectedWalletId}`} replace />
                ) : (
                  <WalletFlow
                    initialStep={initialStep}
                    selectedNetwork={network}
                    onNetworkChange={onNetworkChange}
                    isConnected={isConnected}
                  />
                )
              }
            />
          ))}
        </Route>

        {/* Main Messenging container once you are unlocked */}
        <Route element={<RequireUnlockedWallet />}>
          <Route
            path=":walletId"
            element={
              <>
                <MessengerContainer />
                <ModalDisplay />
              </>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
};
