import React, { useCallback } from 'react'
import { useNetworkStore } from './store/network.store'
import type { NetworkType } from './types/all'
import { AppRoutes } from './AppRoutes';

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
    <AppRoutes
      network={networkStore.network}
      isConnected={networkStore.isConnected}
      onNetworkChange={onNetworkChange}
    />
  );
};

export default App;
