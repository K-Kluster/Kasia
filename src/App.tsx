import React, { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RootLayout } from './components/Layout/RootLayout'
import { WalletGuard } from './containers/WalletGuard'
import { RequireUnlockedWallet } from './containers/RequireUnlockedWallet'
import { OneLiner } from './OneLiner'
import { SettingsPage } from './SettingsPage'
import { useNetworkStore } from './store/network.store'
import type { NetworkType } from './types/all'

const App: React.FC = () => {
  const networkStore = useNetworkStore();
  const connect = useNetworkStore((s) => s.connect);

  const onNetworkChange = useCallback(
    (n: NetworkType) => {
      networkStore.setNetwork(n);
      connect();
    },
    [connect, networkStore]
  );

  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route
          index
          element={
            <WalletGuard
              initialStep="home"
              selectedNetwork={networkStore.network}
              onNetworkChange={onNetworkChange}
              isConnected={networkStore.isConnected}
            />
          }
        />

        <Route path="wallet">
          <Route
            index
            element={
              <WalletGuard
                initialStep="home"
                selectedNetwork={networkStore.network}
                onNetworkChange={onNetworkChange}
                isConnected={networkStore.isConnected}
              />
            }
          />

          <Route
            path="create"
            element={
              <WalletGuard
                initialStep="create"
                selectedNetwork={networkStore.network}
                onNetworkChange={onNetworkChange}
                isConnected={networkStore.isConnected}
              />
            }
          />

          <Route
            path="import"
            element={
              <WalletGuard
                initialStep="import"
                selectedNetwork={networkStore.network}
                onNetworkChange={onNetworkChange}
                isConnected={networkStore.isConnected}
              />
            }
          />

          <Route
            path="unlock/:wallet"
            element={
              <WalletGuard
                initialStep="unlock"
                selectedNetwork={networkStore.network}
                onNetworkChange={onNetworkChange}
                isConnected={networkStore.isConnected}
              />
            }
          />
          <Route
            path="migrate/:wallet"
            element={
              <WalletGuard
                initialStep="migrate"
                selectedNetwork={networkStore.network}
                onNetworkChange={onNetworkChange}
                isConnected={networkStore.isConnected}
              />
            }
          />

          {/* protect the route so people cant access */}
          <Route element={<RequireUnlockedWallet />}>
            <Route path=":walletId" element={<OneLiner />} />
          </Route>
        </Route>

        <Route path="settings-network" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
};

export default App;