import { create } from "zustand";
import { checkKaswareAvailability } from "../utils/wallet-extension";

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
}));
