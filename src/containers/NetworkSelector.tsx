import { FC, useMemo, useEffect, useRef } from "react";
import { NetworkType } from "../type/all";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";

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
    if (!selectedNetwork || selectedNetwork !== "mainnet") {
      onNetworkChange("mainnet");
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

    menuElement.addEventListener('wheel', handler, options);
    return () => {
      menuElement.removeEventListener('wheel', handler);
    };
  }, []);

  const networkDisplay = useMemo(() => {
    // Always show Mainnet if connected, otherwise show appropriate status
    if (isConnected) {
      return "Mainnet";
    }
    return selectedNetwork === "mainnet" ? "Mainnet" : "Connecting to Mainnet...";
  }, [selectedNetwork, isConnected]);

  return (
    <div className="network-selector-container" ref={menuRef}>
      <Menu>
        <MenuButton className="network-badge">
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          {networkDisplay}
        </MenuButton>
        <MenuItems className="network-selector" anchor="bottom">
          <MenuItem>
            <div
              onClick={() => onNetworkChange("mainnet")}
              className={`${
                selectedNetwork === "mainnet" ? "active" : ""
              } network-option`}
            >
              Mainnet
            </div>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>
  );
};
