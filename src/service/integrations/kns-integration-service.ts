import { Address } from "kaspa-wasm";
import { NetworkType } from "../../types/all";

const knsApiRoots = {
  mainnet: "https://api.knsdomains.org/mainnet/api/v1",
  "testnet-10": "https://api.knsdomains.org/tn10/api/v1",
};

export interface KNSDomainResolution {
  /**
   *  Validated Kaspa Address
   */
  ownerAddress: string;
  domain: string;
  id: string;
}

/**
 *
 * @param name - The KNS name to resolve, with suffix (e.g. "example.kas")
 */
export const knsIntegrationService_getDomainResolution = async (
  network: NetworkType,
  name: string
): Promise<KNSDomainResolution | null> => {
  if (network !== "mainnet" && network !== "testnet-10") {
    throw new Error("Unsupported network");
  }

  const rootToUse = knsApiRoots[network];

  const response = await fetch(
    `${rootToUse}/${encodeURIComponent(name)}/owner`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to resolve KNS name");
  }

  const data = await response.json();

  if (!(data.success && data.data && data.data.owner)) {
    throw new Error("Failed to resolve KNS name - Invalid Reponse");
  }

  const asset = data.data.asset;
  if (asset !== name) {
    throw new Error("Failed to resolve KNS name - Corrupted Response");
  }

  try {
    const kaspaAddress = new Address(data.data.owner);

    return {
      domain: name,
      ownerAddress: kaspaAddress.toString(),
      id: data.data.id,
    };
  } catch {
    throw new Error("Failed to resolve KNS name - Invalid Address");
  }
};
