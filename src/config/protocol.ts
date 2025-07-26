type Kind = "ciph_msg" | "handshake" | "comm" | "payment";
type Prefix = { type: Kind; string: string; hex: string };

const VERSION = "1";
const DELIM = ":";

// Universal string to hex conversion
const toHex = (s: string): string =>
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const mk = <K extends Exclude<Kind, "ciph_msg">>(k: K): Prefix => {
  const str = `${VERSION}${DELIM}${k}${DELIM}`;
  return { type: k, string: str, hex: toHex(str) };
};

const PROTOCOL_PREFIX = {
  // no need for separate type cast
  type: "ciph_msg",
  string: `ciph_msg${DELIM}`,
  hex: toHex(`ciph_msg${DELIM}`),
} as const;

export const PROTOCOL = {
  prefix: PROTOCOL_PREFIX,
  headers: {
    HANDSHAKE: mk("handshake"),
    COMM: mk("comm"),
    PAYMENT: mk("payment"),
  },
} as const;
