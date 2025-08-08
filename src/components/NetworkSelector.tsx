import { FC, useMemo } from "react";
import { NetworkType } from "../types/all";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { getDisplayableNetworkFromNetworkString } from "../utils/network-display";

type NetworkSelectorProps = {
  onNetworkChange: (network: NetworkType) => void;
  selectedNetwork: NetworkType | null;
  isConnected?: boolean;
};

export const NetworkSelector: FC<NetworkSelectorProps> = ({
  onNetworkChange,
  selectedNetwork,
  isConnected,
}) => {
  const networkDisplay = useMemo(() => {
    if (!isConnected) {
      return "Connecting...";
    }

    return getDisplayableNetworkFromNetworkString(
      selectedNetwork as NetworkType
    );
  }, [selectedNetwork, isConnected]);

  const allowedNetworks = useMemo<
    { id: NetworkType; displayableString: string }[]
  >(() => {
    return (import.meta.env.VITE_ALLOWED_KASPA_NETWORKS ?? "mainnet")
      .split(",")
      .map((s: string) => ({
        id: s,
        displayableString: getDisplayableNetworkFromNetworkString(s),
      }));
  }, []);

  return (
    <Menu>
      <MenuButton className="inline-flex min-w-[100px] cursor-pointer items-center justify-center gap-2 rounded-3xl border border-[var(--color-kas-secondary)] bg-[var(--color-kas-secondary)]/20 px-3 py-1 text-sm font-medium transition-colors duration-200">
        <span
          className={`inline-block h-2 w-2 animate-pulse rounded-full ${
            isConnected
              ? "bg-[var(--accent-green)] shadow-[0_0_4px_var(--accent-green)]"
              : "bg-[#ef4444] shadow-[0_0_4px_#ef4444]"
          }`}
          style={{
            transformOrigin: "center",
          }}
        />
        {networkDisplay}
      </MenuButton>
      <MenuItems
        className="absolute top-full left-0 z-10 min-w-[140px] rounded-sm border border-[var(--border-color)] bg-[var(--secondary-bg)] shadow-md"
        anchor="bottom"
      >
        {allowedNetworks.map((allowedNetwork) => (
          <MenuItem key={allowedNetwork.id}>
            <div
              onClick={() => onNetworkChange(allowedNetwork.id)}
              className={`block w-full cursor-pointer border-none bg-none px-3 py-2 text-left text-[0.8125rem] text-[var(--text-primary)] transition-colors duration-200 ${
                selectedNetwork === allowedNetwork.id
                  ? "bg-[var(--kas-primary)] text-white"
                  : "hover:bg-[var(--kas-secondary)]"
              }`}
            >
              {allowedNetwork.displayableString}
            </div>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
};
