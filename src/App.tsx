import React, { useCallback, useEffect } from "react";
import { useNetworkStore } from "./store/network.store";
import { useUiStore } from "./store/ui.store";
import type { NetworkType } from "./types/all";
import { AppRoutes } from "./AppRoutes";
import { useIsMobile } from "./utils/useIsMobile";

const App: React.FC = () => {
  const networkStore = useNetworkStore();
  const { theme, getEffectiveTheme } = useUiStore();
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

  // Initialize theme and listen for system changes
  useEffect(() => {
    const effectiveTheme = getEffectiveTheme();
    document.documentElement.setAttribute("data-theme", effectiveTheme);

    // Listen for system theme changes when using "system" mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => {
      if (theme === "system") {
        const newEffectiveTheme = getEffectiveTheme();
        document.documentElement.setAttribute("data-theme", newEffectiveTheme);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme, getEffectiveTheme]);

  return (
    <AppRoutes
      network={networkStore.network}
      isConnected={networkStore.isConnected}
      onNetworkChange={onNetworkChange}
    />
  );
};

export default App;
