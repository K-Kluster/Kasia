import { PROTOCOL } from "../config/protocol";
import { hexToString } from "./format";

export type ParsedKaspaMessagePayload = {
  type: string;
  alias?: string;
  encryptedHex: string;
};

/**
 *
 * @param payload the raw transaction payload (hex-encoded)
 */
export function parseKaspaMessagePayload(
  payload: string
): ParsedKaspaMessagePayload {
  if (!payload.startsWith(PROTOCOL.prefix.hex)) {
    throw new Error("Cannot parse as the transaction payload, prefix missing.");
  }

  // strip prefix
  const payloadWithoutPrefix = payload.substring(PROTOCOL.prefix.hex.length);

  let type = "unknown";
  let alias: string | undefined;
  let encryptedHex = payloadWithoutPrefix;

  if (payloadWithoutPrefix.startsWith(PROTOCOL.headers.HANDSHAKE.hex)) {
    const payloadWithoutPrefixStr = hexToString(payloadWithoutPrefix);
    const parts = payloadWithoutPrefixStr.split(":");

    // 1:handshake:xyz
    if (parts.length >= 3) {
      type = PROTOCOL.headers.HANDSHAKE.type;
      encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.HANDSHAKE.hex.length
      );
    }
  } else if (payloadWithoutPrefix.startsWith(PROTOCOL.headers.COMM.hex)) {
    const payloadWithoutPrefixStr = hexToString(payloadWithoutPrefix);
    const parts = payloadWithoutPrefixStr.split(":");

    // 1:comm:alias:xyz
    if (parts.length >= 4) {
      type = PROTOCOL.headers.COMM.type;
      alias = parts[2];
      encryptedHex = encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.COMM.hex.length + 2 + alias.length * 2
      );
    }
  } else if (payloadWithoutPrefix.startsWith(PROTOCOL.headers.PAYMENT.hex)) {
    const payloadWithoutPrefixStr = hexToString(payloadWithoutPrefix);
    const parts = payloadWithoutPrefixStr.split(":");

    // 1:payment:xyz
    if (parts.length >= 3) {
      type = PROTOCOL.headers.PAYMENT.type;
      encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.PAYMENT.hex.length + 2
      );
    }
  }

  return { type, alias, encryptedHex };
}
