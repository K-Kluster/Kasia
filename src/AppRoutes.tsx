// src/AppRoutes.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./components/Layout/RootLayout";
import { WalletGuard } from "./containers/WalletGuard";
import { RequireUnlockedWallet } from "./containers/RequireUnlockedWallet";
import { OneLiner } from "./OneLiner";
import { SettingsPage } from "./SettingsPage";
import type { NetworkType } from "./types/all";
import type { Step } from "./containers/WalletGuard";

type WalletGuardRouteConfig = {
  path: string | undefined;
  initialStep: Step["type"];
};

const walletGuardRoutes: WalletGuardRouteConfig[] = [
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
}) => (
  <Routes>
    <Route element={<RootLayout />}>
      {/* Home */}
      <Route
        index
        element={
          <WalletGuard
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
        {walletGuardRoutes.map(({ path, initialStep }) => (
          <Route
            key={path!}
            path={path!}
            element={
              <WalletGuard
                initialStep={initialStep}
                selectedNetwork={network}
                onNetworkChange={onNetworkChange}
                isConnected={isConnected}
              />
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
