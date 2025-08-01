import { Address } from "kaspa-wasm";

// validate address using WASM Address.validate method
export const validateAddress = (address: string): boolean => {
  try {
    return Address.validate(address);
  } catch (error) {
    console.error("Address validation error:", error);
    return false;
  }
};

// legacy function for backward compatibility
export const isValidKaspaAddress = validateAddress;
