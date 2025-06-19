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
  const menuRef = useRef<HTMLDivElement>(null);

  // Set default network to mainnet on component mount or if selectedNetwork is null/invalid
  useEffect(() => {
    if (
      !selectedNetwork ||
      selectedNetwork !==
        (import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet")
    ) {
      onNetworkChange(selectedNetwork ?? "mainnet");
    }
  }, [selectedNetwork, onNetworkChange]);

  // Add passive wheel event listeners
  useEffect(() => {
    const menuElement = menuRef.current;
    if (!menuElement) return;

    const options = { passive: true };
    const handler = (e: WheelEvent) => {
      // Handle wheel event if needed
    };

    menuElement.addEventListener("wheel", handler, options);
    return () => {
      menuElement.removeEventListener("wheel", handler);
    };
  }, []);

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
    <div className="network-selector-container" ref={menuRef}>
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
    </div>
  );
};
