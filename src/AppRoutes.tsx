import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./components/Layout/RootLayout";
import { WalletFlow } from "./containers/WalletFlow";
import { RequireUnlockedWallet } from "./containers/RequireUnlockedWallet";
import { OneLiner } from "./OneLiner";
import { SettingsPage } from "./SettingsPage";
import type { NetworkType } from "./types/all";
import type { Step } from "./containers/WalletFlow";
import { useWalletStore } from "./store/wallet.store";

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

        {/* Main Oneliner once you are unlocked */}
        <Route element={<RequireUnlockedWallet />}>
          <Route path=":walletId" element={<OneLiner />} />
        </Route>
        <Route path="settings-network" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
};
