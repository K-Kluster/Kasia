import { PROTOCOL } from "../config/protocol";
// singletons for encoding/decoding
const _encoder = new TextEncoder();

// generic hex → Uint8Array
export const hexToBytes = (hex: string): Uint8Array => {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
  const n = hex.length >> 1;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 2)
    out[i] = parseInt(hex.slice(j, j + 2), 16);
  return out;
};

// try base64 conversion first, fallback to hex if it fails
export const tryBase64ToHex = (input: string): string => {
  const isHex = /^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0;
  if (isHex) return input;

  const isBase64 =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/.test(
      input
    );
  if (isBase64) return base64ToHex(input);

  return input;
};

// check if payload is a message transaction (both hex and base64 formats)
export const isMessagePayload = (p: string | Uint8Array): boolean =>
  !!p &&
  (typeof p === "string"
    ? p.startsWith(PROTOCOL.prefix.hex) || p.startsWith("ciph_msg:")
    : false);

// get encoder singleton for reuse
export const getEncoder = () => _encoder;

// helper function for base64 to hex conversion
const base64ToHex = (b64: string) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
