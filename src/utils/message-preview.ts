import { PROTOCOL } from "../config/protocol";
import { decodePayload } from "./format";
import { getFileTypeFromContent } from "./parse-message";

export function getMessagePreview(content: string) {
  // check if it's a file or image message
  const fileType = getFileTypeFromContent(content);

  if (fileType) {
    try {
      const parsed = JSON.parse(content);
      return parsed.name || (fileType === "image" ? "Image" : "File");
    } catch {
      return fileType === "image" ? "Image" : "File";
    }
  }

  // for regular messages, try to decode if it's encrypted
  if (content.startsWith(PROTOCOL.prefix.string)) {
    const decoded = decodePayload(content);
    return decoded
      ? decoded.slice(0, 40) + (decoded.length > 40 ? "..." : "")
      : "Encrypted message";
  }

  return content.slice(0, 40) + (content.length > 40 ? "..." : "");
}
