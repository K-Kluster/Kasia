import { Message as MessageType } from "../../../../types/all";
import { PROTOCOL } from "../../../../config/protocol";
import { parseKaspaMessagePayload } from "../../../../utils/message-payload";

export const detectMessageType = (message: MessageType) => {
  const { payload, content, fileData } = message;

  // Check if this is a handshake message
  const isHandshake =
    (payload?.startsWith(PROTOCOL.prefix.string) &&
      payload?.includes(PROTOCOL.headers.HANDSHAKE.string)) ||
    (content?.startsWith(PROTOCOL.prefix.string) &&
      content?.includes(PROTOCOL.headers.HANDSHAKE.string));

  // Check if this is a payment message
  const isPayment = (() => {
    if (payload) {
      if (payload.startsWith(PROTOCOL.prefix.hex)) {
        try {
          const parsed = parseKaspaMessagePayload(payload);
          if (parsed.type === PROTOCOL.headers.PAYMENT.type) {
            return true;
          }
        } catch (e) {
          void e;
        }
      }
    }

    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === PROTOCOL.headers.PAYMENT.type) {
          return true;
        }
      } catch (e) {
        void e;
      }
    }

    return false;
  })();

  // Check if this is an image message
  const isImage = (() => {
    if (fileData && fileData.type === "file") {
      return fileData.mimeType.startsWith("image/");
    }

    if (content && content.includes('"type":"file"')) {
      try {
        const parsed = JSON.parse(content);
        return parsed.type === "file" && parsed.mimeType.startsWith("image/");
      } catch (e) {
        void e;
      }
    }

    return false;
  })();

  // Check if this is a file message
  const isFile = (() => {
    if (fileData && fileData.type === "file") {
      return true;
    }

    if (content && content.includes('"type":"file"')) {
      try {
        const parsed = JSON.parse(content);
        return parsed.type === "file";
      } catch (e) {
        void e;
      }
    }

    return false;
  })();

  return {
    isHandshake,
    isPayment,
    isImage,
    isFile,
  };
};
