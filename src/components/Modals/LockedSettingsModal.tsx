import { useCallback, useEffect, useState } from "react";
import { NetworkSelector } from "../NetworkSelector";
import { useNetworkStore } from "../../store/network.store";
import { NetworkType } from "../../types/all";
import { Button } from "../Common/Button";
import { useUiStore } from "../../store/ui.store";
import { ThemeToggle } from "../Common/ThemeToggle";

export const LockedSettingsModal: React.FC = () => {
  const networkStore = useNetworkStore();
  const selectedNetwork = useNetworkStore((state) => state.network);
  const isConnected = useNetworkStore((state) => state.isConnected);
  const isConnecting = useNetworkStore((state) => state.isConnecting);
  const connect = useNetworkStore((state) => state.connect);

  const closeModal = useUiStore((s) => s.closeModal);

  const connectionError = useNetworkStore((s) => s.connectionError);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const [nodeUrl, setNodeUrl] = useState(
    networkStore.nodeUrl ??
      localStorage.getItem(`kasia_node_url_${selectedNetwork}`) ??
      ""
  );

  // Network connection effect
  useEffect(() => {
    // Skip if no network selected or connection attempt in progress
    if (isConnected) {
      return;
    }

    connect();
    // this is on purpose, we only want to run this once upon component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNetworkChange = useCallback(
    (network: NetworkType) => {
      setConnectionSuccess(false);

      networkStore.setNetwork(network);

      const savedNetwork = localStorage.getItem(`kasia_node_url_${network}`);

      setNodeUrl(savedNetwork ?? "");

      connect();
    },
    [connect, networkStore]
  );

  const handleSaveNodeUrl = useCallback(async () => {
    setConnectionSuccess(false);

    if (isConnecting) {
      return;
    }

    networkStore.setNodeUrl(nodeUrl === "" ? undefined : nodeUrl);

    const isSuccess = await connect();

    setConnectionSuccess(isSuccess);
  }, [connect, isConnecting, networkStore, nodeUrl]);

  return (
    <div className="w-full max-w-[600px]">
      <div className="mb-6 flex w-full justify-center md:hidden">
        <ThemeToggle />
      </div>
      <div className="mb-1 flex grow items-center justify-center">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
      </div>

      <h2 className="my-8 text-center text-[1.5rem] font-semibold text-[var(--text-primary)]">
        Network Settings
      </h2>

      <label htmlFor="node-url" className="mb-4 block">
        Force using a node url for the selected network
      </label>
      <div className="flex w-full flex-col items-stretch gap-6">
        <input
          type="text"
          id="node-url"
          value={nodeUrl}
          onChange={(e) => setNodeUrl(e.target.value)}
          className="w-full flex-grow rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] p-2 text-[var(--text-primary)]"
          placeholder="wss://your-own-node-url.com"
        />
        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button
            onClick={handleSaveNodeUrl}
            variant="primary"
            disabled={isConnecting}
          >
            Save
          </Button>
          <Button onClick={() => closeModal("settings")} variant="secondary">
            Close
          </Button>
        </div>
      </div>
      {connectionError && (
        <div className="mt-4 text-red-500">{connectionError}</div>
      )}
      {connectionSuccess && (
        <div className="text-success mt-4">
          Successfully connected to the node!
        </div>
      )}
    </div>
  );
};
