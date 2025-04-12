import { create } from "zustand";
import { checkKaswareAvailability } from "../utils/wallet-extension";

interface KaswareState {
  isKaswareDetected?: boolean;
  selectedAddress?: string;
  refreshKaswareDetection: () => Promise<boolean>;
  setSelectedAddress: (address: string) => void;
}

export const useKaswareStore = create<KaswareState>((set, g) => ({
  isKaswareDetected: undefined,
  selectedAddress: undefined,
  refreshKaswareDetection: async () => {
    const isDetected = await checkKaswareAvailability();

    set({ isKaswareDetected: isDetected });

    return isDetected;
  },
  setSelectedAddress: (address) => {
    set({ selectedAddress: address });
  },
}));
