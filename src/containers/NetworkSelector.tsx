import { FC, useMemo, useEffect } from "react";
import { NetworkType } from "../type/all";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";

type NetworkSelectorProps = {
  onNetworkChange: (network: NetworkType) => void;
  selectedNetwork: NetworkType | null;
};

export const NetworkSelector: FC<NetworkSelectorProps> = ({
  onNetworkChange,
  selectedNetwork,
}) => {
  // Set default network to testnet-10 on component mount
  useEffect(() => {
    if (!selectedNetwork) {
      onNetworkChange("testnet-10");
    }
  }, [selectedNetwork, onNetworkChange]);

  const networkDisplay = useMemo(() => {
    switch (selectedNetwork) {
      case "mainnet":
        return "Mainnet";
      case "testnet-10":
        return "Testnet 10";
      case "testnet-11":
        return "Testnet 11";
      case null:
        return "Select Network";
      default:
        return "Unknown Network";
    }
  }, [selectedNetwork]);

  return (
    <div className="network-selector-container">
      <Menu>
        <MenuButton className="network-badge">{networkDisplay}</MenuButton>
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
          <MenuItem>
            <div
              onClick={() => onNetworkChange("testnet-10")}
              className={`${
                selectedNetwork === "testnet-10" ? "active" : ""
              } network-option`}
            >
              Testnet 10
            </div>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>
  );
};
