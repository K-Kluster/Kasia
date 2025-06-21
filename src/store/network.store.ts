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

      let attempt = 0;
      // initial delay in milliseconds
      let delay = 200;
      const maxRetries = 5;
      while (attempt < maxRetries) {
        try {
          await kaspaClient.connect();
          unstable_batchedUpdates(() => {
            useWalletStore.getState().setRpcClient(kaspaClient);
            useWalletStore.getState().setSelectedNetwork(g().network);
          });
          set({ isConnected: true, connectionError: undefined });
          return; // Exit the function if connection is successful
        } catch (error) {
          console.error(
            `Failed to connect to KaspaClient (attempt ${attempt + 1}):`,
            error
          );
          set({ connectionError: unknownErrorToErrorLike(error).message });
          attempt++;
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        } finally {
          set({ isConnecting: false });
        }
      }

      console.error("Max retries reached. Could not connect to KaspaClient.");
      set({
        connectionError:
          "Max retries reached. Could not connect to KaspaClient.",
      });
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
