import { KasiaConversationEvent } from "../../../../types/all";
import { PROTOCOL } from "../../../../config/protocol";

export const detectEventType = (event: KasiaConversationEvent) => {
  const { __type, content } = event;

  // handshake
  const isHandshake =
    __type === "handshake" ||
    (content?.startsWith(PROTOCOL.prefix.string) &&
      content?.includes(PROTOCOL.headers.HANDSHAKE.string));

  // payment
  const isPayment = (() => {
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return parsed.type === PROTOCOL.headers.PAYMENT.type;
      } catch {
        /* ignore */
      }
    }
    return __type === "payment";
  })();

  // // image / file
  // const isImage = (() => {
  //   if (fileData?.type === "file" && fileData.mimeType?.startsWith?.("image/"))
  //     return true;
  //   if (content && content.includes('"type":"file"')) {
  //     try {
  //       const parsed = JSON.parse(content);
  //       return (
  //         parsed.type === "file" && parsed.mimeType?.startsWith?.("image/")
  //       );
  //     } catch {
  //       /* ignore */
  //     }
  //   }
  //   return false;
  // })();

  // const isFile = (() => {
  //   if (fileData?.type === "file") return true;
  //   if (content && content.includes('"type":"file"')) {
  //     try {
  //       const parsed = JSON.parse(content);
  //       return parsed.type === "file";
  //     } catch {
  //       /* ignore */
  //     }
  //   }
  //   return false;
  // })();

  return { isHandshake, isPayment };
};
