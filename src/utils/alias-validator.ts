export type Alias = string & { __brand: "Alias" };

export const isAlias = (value: unknown): value is Alias => {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{12}$/.test(value);
};
