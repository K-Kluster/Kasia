import { ALIAS_LENGTH } from "../config/constants";

export type Alias = string & { __brand: "Alias" };

export const isAlias = (value: unknown): value is Alias => {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{12}$/.test(value);
};

export const validateAlias = (alias: string): string | null => {
  if (!/^[0-9a-fA-F]+$/.test(alias)) {
    return "Alias must be a hexadecimal string";
  }

  if (alias.length !== ALIAS_LENGTH * 2) {
    return `Alias must be exactly ${ALIAS_LENGTH * 2} characters`;
  }

  return null; // valid
};
