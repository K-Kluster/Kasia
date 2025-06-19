import { NetworkType } from "kaspa-wasm";

export enum KasiaNetwork {
  MAINNET = "mainnet",
  TESTNET_10 = "testnet-10",
}

export const getDisplayableNetworkFromNetworkString = (network: string) => {
  console.log(network);
  if (network === KasiaNetwork.MAINNET) {
    return "Mainnet";
  }

  if (network === KasiaNetwork.TESTNET_10) {
    return "Testnet";
  }

  return "Unknown";
};

// export const getDisplayableNetworkFromNetworkType = (
//   networkType?: NetworkType | null
// ) => {
//   console.log(networkType);

//   if (networkType === NetworkType.Mainnet) {
//     return "Mainnet";
//   }

//   if (networkType === NetworkType.Testnet) {
//     return "Testnet";
//   }

//   return "Unknown";
// };

// export const getNetworkTypeFromNetworkString = (network: string) => {
//   if (network === KasiaNetwork.MAINNET) {
//     return NetworkType.Mainnet;
//   }

//   if (network === KasiaNetwork.TESTNET_10) {
//     return NetworkType.Testnet;
//   }

//   return NetworkType.Mainnet;
// };
