export enum KasiaNetwork {
  MAINNET = "mainnet",
  TESTNET_10 = "testnet-10",
  TESTNET_12 = "testnet-12",
}

export const getDisplayableNetworkFromNetworkString = (network: string) => {
  if (network === KasiaNetwork.MAINNET) {
    return "Mainnet";
  }

  if (network === KasiaNetwork.TESTNET_10) {
    return "Testnet";
  }

  if (network === KasiaNetwork.TESTNET_12) {
    return "Cov++ Testnet";
  }

  return "Unknown";
};
