import { useCallback, useEffect, useState } from "react";
import { NetworkSelector } from "./containers/NetworkSelector";
import { useNetworkStore } from "./store/network.store";
import { NetworkType } from "./types/all";
import { Button } from "./components/Common/Button";
import { useNavigate } from "react-router";

export const SettingsPage: React.FC = () => {
  const networkStore = useNetworkStore();
  const selectedNetwork = useNetworkStore((state) => state.network);
  const isConnected = useNetworkStore((state) => state.isConnected);
  const isConnecting = useNetworkStore((state) => state.isConnecting);
  const connect = useNetworkStore((state) => state.connect);
  const navigate = useNavigate();

  const connectionError = useNetworkStore((s) => s.connectionError);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const [nodeUrl, setNodeUrl] = useState(
    networkStore.nodeUrl ??
      localStorage.getItem("`kasia_node_url_${initialNetwork}`") ??
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
    <div className="app">
      <div className="px-1 sm:px-8 py-4 bg-[var(--primary-bg)]">
        <div className="flex items-center gap-4">
          <div className="max-w-[600px] relative mx-auto my-8 p-8 bg-[var(--secondary-bg)] rounded-lg border border-[var(--border-color)]">
            <div className="grow flex items-center justify-center mb-1">
              <NetworkSelector
                selectedNetwork={selectedNetwork}
                onNetworkChange={onNetworkChange}
                isConnected={isConnected}
              />
            </div>

            <h2 className="text-center my-8 text-[var(--text-primary)] text-[1.5rem] font-semibold">
              Settings
            </h2>

            <label htmlFor="node-url" className="block mb-4">
              Force using a node url for the selected network
            </label>
            <div className="flex flex-col items-stretch gap-6 w-full">
              <input
                type="text"
                id="node-url"
                value={nodeUrl}
                onChange={(e) => setNodeUrl(e.target.value)}
                className="w-full flex-grow p-2 border border-[var(--border-color)] rounded bg-[var(--input-bg)] text-[var(--text-primary)]"
                placeholder="wss://your-own-node-url.com"
              />
              <div className="flex flex-col gap-2 justify-center sm:flex-row-reverse sm:gap-4">
                <Button
                  onClick={handleSaveNodeUrl}
                  variant="primary"
                  disabled={isConnecting}
                >
                  Save
                </Button>
                <Button onClick={() => navigate("/")} variant="secondary">
                  Go Back
                </Button>
              </div>
            </div>
            {connectionError && (
              <div className="text-red-500 mt-4">{connectionError}</div>
            )}
            {connectionSuccess && (
              <div className="text-success mt-4">
                Successfully connected to the node!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
