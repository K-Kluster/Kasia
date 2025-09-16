import { useNetworkStore } from "../store/network.store";

export enum KasiaNetwork {
  MAINNET = "mainnet",
  TESTNET_10 = "testnet-10",
}

export const getDisplayableNetworkFromNetworkString = (network: string) => {
  if (network === KasiaNetwork.MAINNET) {
    return "Mainnet";
  }

  if (network === KasiaNetwork.TESTNET_10) {
    return "Testnet";
  }

  return "Unknown";
};

/**
 * get the display unit for Kaspa amounts based on current network
 * returns "KAS" for mainnet, "TKAS" for testnet
 */
export const getKasUnitDisplay = (): string => {
  const network = useNetworkStore.getState().network;
  return network === "mainnet" ? "KAS" : "TKAS";
};
