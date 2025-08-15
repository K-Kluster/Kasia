import { FileData } from "../store/repository/message.repository";
import { KasiaConversationEvent } from "../types/all";

export function extractFileData(e: KasiaConversationEvent): FileData | null {
  // check if it's a message with fileData property
  if (
    e.__type === "message" &&
    "fileData" in e &&
    e.fileData?.type === "file"
  ) {
    return e.fileData as FileData;
  }

  if (e.content) {
    try {
      const parsed = JSON.parse(e.content);
      if (parsed?.type === "file") {
        return {
          ...parsed,
          size: parsed.size || 0,
        } as FileData;
      }
    } catch {
      // not JSON, ignore
    }
  }
  return null;
}

export function isImageType(e: KasiaConversationEvent): boolean {
  const fileData = extractFileData(e);
  return fileData?.mimeType?.startsWith("image/") ?? false;
}

export function isFileType(e: KasiaConversationEvent): boolean {
  const fileData = extractFileData(e);
  return fileData?.type === "file";
}

export function isImageContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed?.mimeType?.startsWith("image/") ?? false;
  } catch {
    return false;
  }
}

export function isFileContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed?.type === "file";
  } catch {
    return false;
  }
}

export function getFileType(
  e: KasiaConversationEvent
): "image" | "file" | null {
  if (isImageType(e)) return "image";
  if (isFileType(e)) return "file";
  return null;
}

export function getFileTypeFromContent(
  content: string
): "image" | "file" | null {
  if (isImageContent(content)) return "image";
  if (isFileContent(content)) return "file";
  return null;
}
