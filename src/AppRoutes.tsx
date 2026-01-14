import React from "react";
import { Routes, Route, Navigate } from "react-router";
import { RootLayout } from "./components/Layout/RootLayout";
import {
  WalletLockedFlowContainer,
  Step,
} from "./containers/WalletLockedFlowContainer";

import type { NetworkType } from "./types/all";
import { useWalletStore } from "./store/wallet.store";
import { DirectsContainer } from "./containers/DirectsContainer";
import { BroadcastsContainer } from "./containers/BroadcastsContainer";
import { MessengerProvider } from "./containers/MessengerProvider";

type WalletFlowRouteConfig = {
  path: string | undefined;
  initialStep: Step["type"];
};

const walletFlowRoutes: WalletFlowRouteConfig[] = [
  { path: "create", initialStep: "create" },
  { path: "import", initialStep: "import" },
  { path: "unlock/:wallet", initialStep: "unlock" },
];

export type AppRoutesProps = {
  network: NetworkType;
  isConnected: boolean;
  isConnecting: boolean;
  onNetworkChange: (n: NetworkType) => void;
};

export const AppRoutes: React.FC<AppRoutesProps> = ({
  network,
  isConnected,
  isConnecting,
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
            <WalletLockedFlowContainer
              initialStep="home"
              selectedNetwork={network}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
              isConnecting={isConnecting}
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
                  <Navigate to={`/${selectedWalletId}/directs`} replace />
                ) : (
                  <WalletLockedFlowContainer
                    initialStep={initialStep}
                    selectedNetwork={network}
                    onNetworkChange={onNetworkChange}
                    isConnected={isConnected}
                    isConnecting={isConnecting}
                  />
                )
              }
            />
          ))}
        </Route>

        {/* Main Messaging container once you are unlocked */}
        {unlockedWallet ? (
          <Route element={<MessengerProvider />}>
            <Route path=":walletId/directs" element={<DirectsContainer />} />
            <Route
              path=":walletId/directs/:contactId"
              element={<DirectsContainer />}
            />
            <Route
              path=":walletId/directs/group/:groupId"
              element={<DirectsContainer />}
            />
            <Route
              path=":walletId/broadcasts"
              element={<BroadcastsContainer />}
            />
            <Route
              path=":walletId/broadcasts/:channelId"
              element={<BroadcastsContainer />}
            />
          </Route>
        ) : (
          <Route path="/*" element={<Navigate to="/" replace />} />
        )}
      </Route>
    </Routes>
  );
};
