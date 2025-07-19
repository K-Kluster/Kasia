export function parseImageFileJson(
  input: string
): { content: string; mimeType: string; name: string } | null {
  if (!input || input[0] !== "{") return null;
  try {
    const obj = JSON.parse(input);
    if (
      obj.type === "file" &&
      typeof obj.content === "string" &&
      typeof obj.mimeType === "string" &&
      obj.mimeType.startsWith("image/")
    ) {
      return obj;
    }
  } catch {
    // not valid JSON
  }
  return null;
}
