import { create } from "zustand";
import { checkKaswareAvailability } from "../utils/wallet-extension";
import { NetworkType } from "../type/all";

interface KaswareState {
  balance:
    | { confirmed: number; unconfirmed: number; total: number }
    | undefined;
  utxoEntries: unknown[] | undefined;
  isKaswareDetected?: boolean;
  selectedAddress?: string;
  refreshKaswareDetection: () => Promise<boolean>;
  setSelectedAddress: (address: string) => void;
  populateKaswareInformation: () => Promise<void>;
  getKaswareCurrentNetwork: () => Promise<NetworkType | null>;
  switchKaswareNetwork: (network: NetworkType) => Promise<void>;
}

export const useKaswareStore = create<KaswareState>((set, g) => ({
  isKaswareDetected: undefined,
  selectedAddress: undefined,
  balance: undefined,
  utxoEntries: undefined,
  refreshKaswareDetection: async () => {
    const isDetected = await checkKaswareAvailability();

    set({ isKaswareDetected: isDetected });

    return isDetected;
  },
  populateKaswareInformation: async () => {
    const selectedAddress = g().selectedAddress;
    if (!selectedAddress) return;

    const utxoEntries = await window.kasware.getUtxoEntries(selectedAddress);
    const balance = await window.kasware.getBalance(selectedAddress);

    set({ utxoEntries, balance });
  },
  setSelectedAddress: (address) => {
    console.log("Setting selected address:", address);
    set({ selectedAddress: address });
  },
  getKaswareCurrentNetwork: async () => {
    // Get network from kasware
    const kaswareNetwork: string | null = await window.kasware.getNetwork();

    // Map KasWare network to SDK network format
    const networkMap: Record<string, NetworkType> = {
      kaspa_mainnet: "mainnet",
      "kaspa-mainnet": "mainnet",
      kaspa_testnet_10: "testnet-10",
      "kaspa-testnet-10": "testnet-10",
      kaspa_testnet_11: "testnet-11",
      "kaspa-testnet-11": "testnet-11",
      kaspa_devnet: "devnet",
      "kaspa-devnet": "devnet",
    };

    // If no network is set, default to testnet-10
    const network = kaswareNetwork ? networkMap[kaswareNetwork] : "testnet-10";

    return network;
  },
  switchKaswareNetwork: async (network: NetworkType) => {
    await window.kasware.switchNetwork(`kaspa_${network.replace("-", "_")}`);
  },
}));
