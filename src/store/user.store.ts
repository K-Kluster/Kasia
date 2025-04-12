import { create } from "zustand";

interface UserState {
  selectedNetwork: string;
  //   kaspaAddress?: string;
  setSelectedNetwork: (network: string) => void;
  //   setKaspaAddress: (kaspaAddress: string) => void;
}

export const useUserStore = create<UserState>((set, g) => ({
  selectedNetwork: "mainnet",
  //   kaspaAddress: undefined,
  //   setKaspaAddress: (kaspaAddress) => {
  //     set({
  //       kaspaAddress,
  //     });
  //   },
  setSelectedNetwork: (network) => {
    set({
      selectedNetwork: network,
    });
  },
}));
