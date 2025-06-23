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
