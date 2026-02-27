import { PROTOCOL } from "../config/protocol";
import { hexToString } from "./format";
import { ITransaction } from "wasm/kaspa";

export type ParsedKaspaMessagePayload = {
  type: string;
  alias?: string;
  scope?: string;
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
  let scope: string | undefined;
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
      // extract the encrypted hex part after "1:payment:"
      encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.PAYMENT.hex.length
      );
    }
  } else if (payloadWithoutPrefix.startsWith(PROTOCOL.headers.SELF_STASH.hex)) {
    const payloadWithoutPrefixStr = hexToString(payloadWithoutPrefix);
    const parts = payloadWithoutPrefixStr.split(":");

    // 1:self_stash[:scope]:data
    // note: scope is optional from a protocol perspective
    if (parts.length >= 3) {
      type = PROTOCOL.headers.SELF_STASH.type;

      encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.SELF_STASH.hex.length + 2
      );

      if (parts.length >= 4) {
        scope = parts[2];

        encryptedHex = payloadWithoutPrefix.substr(
          PROTOCOL.headers.SELF_STASH.hex.length + 2 + scope.length * 2
        );
      }
    }
  } else if (payloadWithoutPrefix.startsWith(PROTOCOL.headers.BROADCAST.hex)) {
    const payloadWithoutPrefixStr = hexToString(payloadWithoutPrefix);
    const parts = payloadWithoutPrefixStr.split(":");

    // 1:bcast:channelName:messageContent
    if (parts.length >= 4) {
      type = PROTOCOL.headers.BROADCAST.type;
      // For broadcasts, we don't need alias or encryptedHex since they're plain text
      // But we'll extract the channel name for reference
      const channelName = parts[2];
      encryptedHex = payloadWithoutPrefix.substr(
        PROTOCOL.headers.BROADCAST.hex.length + 2 + channelName.length * 2
      );
    }
  }

  return { type, alias, encryptedHex, scope };
}

export function isKasiaTransaction(tx: ITransaction): boolean {
  return tx?.payload?.startsWith(PROTOCOL.prefix.hex) ?? false;
}
