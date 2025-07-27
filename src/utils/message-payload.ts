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
