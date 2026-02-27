import { NetworkType } from "kaspa-wasm";

// Helper function to determine network type from address
export function getNetworkTypeFromAddress(address: string): NetworkType {
  if (address.startsWith("kaspatest:")) {
    return NetworkType.Testnet;
  } else if (address.startsWith("kaspadev:")) {
    return NetworkType.Devnet;
  }
  return NetworkType.Mainnet;
}

// Helper function to ensure an address has the proper network prefix
export function ensureAddressPrefix(
  address: string,
  networkId: string
): string {
  // If address already has a prefix, return it unchanged
  if (address.includes(":")) {
    return address;
  }

  // Add appropriate prefix based on network
  if (networkId === "testnet-10" || networkId === "testnet-12") {
    return `kaspatest:${address}`;
  } else if (networkId === "mainnet") {
    return `kaspa:${address}`;
  } else if (networkId === "devnet") {
    return `kaspadev:${address}`;
  }

  // Default to mainnet if network is unknown
  return `kaspa:${address}`;
}
