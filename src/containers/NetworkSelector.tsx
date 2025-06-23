import { FC, useMemo, useEffect, useRef } from "react";
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
        <MenuButton className="network-badge">
          <span
            className={`connection-dot ${
              isConnected ? "connected" : "disconnected"
            }`}
          />
          {networkDisplay}
        </MenuButton>
        <MenuItems className="network-selector" anchor="bottom">
          {allowedNetworks.map((allowedNetwork) => (
            <MenuItem key={allowedNetwork.id}>
              <div
                onClick={() => onNetworkChange(allowedNetwork.id)}
                className={`${
                  selectedNetwork === allowedNetwork.id ? "active" : ""
                } network-option`}
              >
                {allowedNetwork.displayableString}
              </div>
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
  );
};
