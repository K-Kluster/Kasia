import { create } from "zustand";
import { NetworkType } from "../types/all";
import { KaspaClient } from "../utils/all-in-one";
import { unknownErrorToErrorLike } from "../utils/errors";
import { useWalletStore } from "./wallet.store";
import { unstable_batchedUpdates } from "react-dom";

interface NetworkState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError?: string;
  network: NetworkType;
  kaspaClient: KaspaClient;
  nodeUrl: string | undefined;

  /**
   * requires a call to `.connect(network: NetworkType)` if you want changes to be applied
   *
   * note: this persist the node url on the local storage and will be re-used on next startup
   */
  setNodeUrl: (url: string) => void;
  /**
   * requires a call to `.connect(network: NetworkType)` if you want changes to be applied
   */
  setNetwork: (network: NetworkType) => void;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useNetworkStore = create<NetworkState>((set, g) => {
  const initialNetwork =
    import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet";
  const initialNodeUrl =
    localStorage.getItem("kasia_kaspa_node_url") ?? undefined;
  return {
    isConnected: false,
    isConnecting: false,
    connectionError: undefined,
    network: initialNetwork,
    client: new KaspaClient(initialNetwork),
    nodeUrl: initialNodeUrl,
    kaspaClient: new KaspaClient({
      networkId: initialNetwork,
      nodeUrl: initialNodeUrl,
    }),
    async connect() {
      let kaspaClient = g().kaspaClient;

      const isDifferentNetwork = kaspaClient.networkId !== g().network;
      const isDifferentUrl = kaspaClient.rpc?.url !== g().nodeUrl;

      if (!isDifferentNetwork && !isDifferentUrl && g().isConnected) {
        console.warn(
          "Trying to connect KaspaClient while it is already connected."
        );
        return;
      }

      if ((isDifferentNetwork || isDifferentUrl) && kaspaClient.connected) {
        await kaspaClient.disconnect();
      }

      if (isDifferentNetwork || isDifferentUrl) {
        kaspaClient = new KaspaClient({
          networkId: g().network,
          nodeUrl: g().nodeUrl,
        });

        set({
          kaspaClient,
        });
      }

      set({ isConnecting: true, connectionError: undefined });

      // @TODO: re-implement exponential backoff
      try {
        await kaspaClient.connect();
        unstable_batchedUpdates(() => {
          useWalletStore.getState().setRpcClient(kaspaClient);
        });
        set({ isConnected: true, connectionError: undefined });
      } catch (error) {
        console.error("Failed to connect to KaspaClient:", error);
        set({ connectionError: unknownErrorToErrorLike(error).message });
      } finally {
        set({ isConnecting: false });
      }
    },
    async disconnect() {
      const kaspaClient = g().kaspaClient;
      if (kaspaClient.connected) {
        await kaspaClient.disconnect();
        set({ isConnected: false, connectionError: undefined });
      }
    },
    setNetwork(network) {
      set({ network });
    },
    setNodeUrl(nodeUrl) {
      set({ nodeUrl });
    },
  };
});
