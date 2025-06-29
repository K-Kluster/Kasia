import React, { useCallback, useEffect } from "react";
import { useNetworkStore } from "./store/network.store";
import type { NetworkType } from "./types/all";
import { AppRoutes } from "./AppRoutes";
import { useIsMobile } from "./utils/useIsMobile";

const App: React.FC = () => {
  const networkStore = useNetworkStore();
  const connect = useNetworkStore((s) => s.connect);
  const isMobile = useIsMobile();

  const onNetworkChange = useCallback(
    (n: NetworkType) => {
      networkStore.setNetwork(n);
      connect();
    },
    [connect, networkStore]
  );

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]'
    );
    if (!meta) return;
    meta.content = isMobile
      ? "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      : "width=device-width, initial-scale=1.0";
  }, [isMobile]);

  return (
    <AppRoutes
      network={networkStore.network}
      isConnected={networkStore.isConnected}
      onNetworkChange={onNetworkChange}
    />
  );
};

export default App;
