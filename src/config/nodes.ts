import { NetworkType } from "../type/all";

export type NodeConfig = {
  url: string;
  description: string;
  useWebSocket?: boolean;
};

export type NetworkConfig = {
  nodes: NodeConfig[];
  apiEndpoint: string;
};

export const networkConfigs: Record<NetworkType, NetworkConfig> = {
  "mainnet": {
    nodes: [
      { url: "wss://kaspa.aspectron.org/kaspa/mainnet/wrpc/borsh", description: "Aspectron (WebSocket)" },
      { url: "wss://node.kaspad.net/kaspa/mainnet/wrpc/borsh", description: "Kaspad.net (WebSocket)" },
      { url: "wss://mainnet.kaspa.ws/kaspa/mainnet/wrpc/borsh", description: "Kaspa.ws (WebSocket)" },
      { url: "wss://mainnet.kaspanet.io/kaspa/mainnet/wrpc/borsh", description: "KaspaNet.io (WebSocket)" },
      { url: "wss://mainnet.kaspa.org/kaspa/mainnet/wrpc/borsh", description: "Kaspa.org (WebSocket)" },
    ],
    apiEndpoint: "https://api.kaspa.org"
  },
  "testnet-10": {
    nodes: [
      { url: "wss://fermion-10.kaspa.green/kaspa/testnet-10/wrpc/borsh", description: "Kaspa Green (WebSocket)", useWebSocket: true },
      { url: "wss://kaspa-testnet.aspectron.org/kaspa/testnet-10/wrpc/borsh", description: "Aspectron (WebSocket)", useWebSocket: true },
      { url: "wss://api.kaspatestnet.org/ws", description: "KaspaTestnet.org (WebSocket)", useWebSocket: true },
    ],
    apiEndpoint: "https://api-tn10.kaspa.org"
  },
  "testnet-11": {
    nodes: [
      { url: "wss://fermion-11.kaspa.green/kaspa/testnet-11/wrpc/borsh", description: "Kaspa Green (WebSocket)" },
    ],
    apiEndpoint: "https://api-tn11.kaspa.org"
  },
  "devnet": {
    nodes: [
      { url: "wss://fermion-dev.kaspa.green/kaspa/devnet/wrpc/borsh", description: "Kaspa Green (WebSocket)" },
    ],
    apiEndpoint: "https://api-dev.kaspa.org"
  },
};

export const getNodesForNetwork = (network: NetworkType): NodeConfig[] => {
  return networkConfigs[network]?.nodes || [];
};

export const getApiEndpoint = (network: NetworkType): string => {
  return networkConfigs[network]?.apiEndpoint || networkConfigs["testnet-10"].apiEndpoint;
}; 