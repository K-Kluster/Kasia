import { useCallback, useEffect, useState } from "react";
import { NetworkSelector } from "./containers/NetworkSelector";
import { useNetworkStore } from "./store/network.store";
import { NetworkType } from "./types/all";
import clsx from "clsx";
import { Link } from "react-router";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

export const SettingsPage: React.FC = () => {
  const networkStore = useNetworkStore();
  const selectedNetwork = useNetworkStore((state) => state.network);
  const isConnected = useNetworkStore((state) => state.isConnected);
  const isConnecting = useNetworkStore((state) => state.isConnecting);
  const connect = useNetworkStore((state) => state.connect);

  const connectionError = useNetworkStore((s) => s.connectionError);

  const [nodeUrl, setNodeUrl] = useState(networkStore.nodeUrl ?? "");

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
      networkStore.setNetwork(network);

      connect();
    },
    [connect, networkStore]
  );

  const handleSaveNodeUrl = useCallback(() => {
    if (isConnecting) {
      return;
    }

    networkStore.setNodeUrl(nodeUrl);

    connect();
  }, [connect, isConnecting, networkStore, nodeUrl]);

  return (
    <div className="container">
      <div className="text-center px-8 py-1 border-b border-[var(--border-color)] relative flex items-center justify-between bg-[var(--secondary-bg)]">
        <Link to="/">
          <div className="app-title flex items-center gap-2 hover:cursor-pointer">
            <img src="/kasia-logo.png" alt="Kasia Logo" className="app-logo" />
            <h1 className="text-xl font-bold">Kasia</h1>
          </div>
        </Link>
      </div>

      <div className="px-8 py-4 bg-[var(--primary-bg)]">
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
            <div className="flex items-center gap-4">
              <input
                type="text"
                id="node-url"
                value={nodeUrl}
                onChange={(e) => setNodeUrl(e.target.value)}
                className="flex-grow p-2 border border-[var(--border-color)] rounded bg-[var(--input-bg)] text-[var(--text-primary)]"
                placeholder="wss://your-own-node-url.com"
              />
              <button
                onClick={handleSaveNodeUrl}
                className={clsx(
                  "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
            {connectionError && (
              <div className="text-red-500 mt-4">{connectionError}</div>
            )}
            <div className="flex justify-start mt-16">
              <Link to="/">
                <button className="leading-8  bg-[var(--primary-bg)] hover:opacity-80 text-white text-sm font-bold py-2 px-4 rounded cursor-pointer">
                  <ArrowLeftIcon className="size-6 font-bold inline-block mr-2" />
                  Go Back
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
