import { PROTOCOL } from "../config/protocol";
import { hexToString } from "./format";

export type ParsedKaspaMessagePayload = {
  type: string;
  alias?: string;
  encryptedHex: string;
};

export function parseKaspaMessagePayload(
  payload: string
): ParsedKaspaMessagePayload {
  // Remove protocol prefix if present
  let messageHex = payload;
  if (payload.startsWith(PROTOCOL.prefix.hex)) {
    messageHex = payload.substring(PROTOCOL.prefix.hex.length);
  }

  let type = "unknown";
  let alias: string | undefined;
  let encryptedHex = messageHex;

  if (messageHex.startsWith(PROTOCOL.headers.HANDSHAKE.hex)) {
    type = PROTOCOL.headers.HANDSHAKE.type;
    encryptedHex = messageHex;
  } else if (messageHex.startsWith(PROTOCOL.headers.COMM.hex)) {
    const messageStr = hexToString(messageHex);
    const parts = messageStr.split(":");
    if (parts.length >= 4) {
      type = PROTOCOL.headers.COMM.type;
      alias = parts[2];
      encryptedHex = parts[3];
    }
  } else if (messageHex.startsWith(PROTOCOL.headers.PAYMENT.hex)) {
    const messageStr = hexToString(messageHex);
    const parts = messageStr.split(":");
    if (parts.length >= 3) {
      type = PROTOCOL.headers.PAYMENT.type;
      encryptedHex = parts[2];
    }
  }

  return { type, alias, encryptedHex };
}

// singletons for encoding/decoding
const _decoder = new TextDecoder();
const _encoder = new TextEncoder();

// normalize once - reusable payload decoder
const toUtf8 = (p: string | Uint8Array) =>
  typeof p === "string" ? p : _decoder.decode(p);

// tiny byte-prefix helper (optional)
const bytesStartsWith = (u: Uint8Array, s: string) => {
  if (u.length < s.length) return false;
  for (let i = 0; i < s.length; i++) if (u[i] !== s.charCodeAt(i)) return false;
  return true;
};

// generic hex → Uint8Array
export const hexToBytes = (hex: string): Uint8Array => {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
  const n = hex.length >> 1;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 2)
    out[i] = parseInt(hex.slice(j, j + 2), 16);
  return out;
};

export const base64ToHex = (b64: string) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// hex → ASCII (reuse hexToBytes + decoder)
export const hexToAscii = (hex: string) => _decoder.decode(hexToBytes(hex));

// fast payload type checking without allocations
export const isKasiaPayload = (p: string | Uint8Array): boolean => {
  if (!p) return false;
  if (typeof p === "string")
    return (
      p.startsWith(PROTOCOL.prefix.hex) || p.startsWith(PROTOCOL.prefix.string)
    );
  const u = p as Uint8Array;
  if (u.length < 9) return false;
  if (bytesStartsWith(u, "ciph_msg:")) return true; // new format
  return toUtf8(u).startsWith(PROTOCOL.prefix.hex); // legacy hex prefix
};

// check if payload is a message transaction (both hex and base64 formats)
export const isMessagePayload = (p: string | Uint8Array): boolean =>
  !!p &&
  (toUtf8(p).startsWith(PROTOCOL.prefix.hex) ||
    toUtf8(p).startsWith("ciph_msg:"));

// get encoder singleton for reuse
export const getEncoder = () => _encoder;

// check if payload is a payment transaction — restore inclusive check (no false negatives)
export const isPaymentPayload = (p: string | Uint8Array): boolean =>
  !!p &&
  (toUtf8(p).includes(PROTOCOL.headers.PAYMENT.hex) ||
    toUtf8(p).includes("payment"));

// check if payload is a handshake transaction (both hex and base64 formats)
export const isHandshakePayload = (p: string | Uint8Array): boolean =>
  !!p &&
  (toUtf8(p).startsWith("ciph_msg:1:handshake") ||
    toUtf8(p).includes(PROTOCOL.headers.HANDSHAKE.hex));

// check if payload starts with hex prefix
export const startsWithHexPrefix = (p: string | Uint8Array): boolean =>
  !!p && toUtf8(p).startsWith(PROTOCOL.prefix.hex);
