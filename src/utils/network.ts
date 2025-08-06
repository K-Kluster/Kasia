import { NetworkType } from "kaspa-wasm";

// Helper function to determine network type from address
export function getNetworkTypeFromAddress(address: string): NetworkType {
  if (address.startsWith("kaspatest:")) {
    return NetworkType.Mainnet;
  } else if (address.startsWith("kaspadev:")) {
    return NetworkType.Devnet;
  }
  return NetworkType.Mainnet;
}
