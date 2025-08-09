import { NetworkType } from "../types/all";

export const getExplorerUrl = (txId: string, network: NetworkType) => {
  switch (network) {
    case "mainnet":
      return `https://explorer.kaspa.org/txs/${txId}`;
    case "testnet-10":
      return `https://explorer-tn10.kaspa.org/txs/${txId}`;
    case "testnet-11":
      return `https://explorer-tn11.kaspa.org/txs/${txId}`;
    case "devnet":
      return `https://explorer-devnet.kaspa.org/txs/${txId}`;
  }
};
