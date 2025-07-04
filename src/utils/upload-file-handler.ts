export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxQuality?: number;
  minQuality?: number;
  maxAttempts?: number;
}

export interface PrepareFileResult {
  fileMessage?: string;
  file?: File;
  error?: string;
}

const toDataURL = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () =>
      typeof r.result === "string"
        ? res(r.result)
        : rej(new Error("Failed to read file as base64"));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

const JSON_WRAP_LEN = // we need this to gauge how much we space we need beyond the file itself
  JSON.stringify({ type: "file", name: "", size: 0, mimeType: "", content: "" })
    .length + 23;

/**
 * prepare a file for upload: compresses if needed, encodes as base64, returns JSON message or error.
 */
export async function prepareFileForUpload(
  file: File,
  maxSize: number,
  compressOptions: CompressImageOptions = {},
  onStatus?: (status: string) => void
): Promise<PrepareFileResult> {
  const rawTarget = Math.floor(((maxSize - JSON_WRAP_LEN) * 3) / 4);

  {
    /*default return for NON images */
  }
  if (file.size > rawTarget && !file.type.startsWith("image/"))
    return {
      error: `File too large. Please keep files under ${maxSize / 1024}KB to ensure it fits in a Kaspa transaction.`,
    };

  let candidate: File | null = file;
  let wasCompressed = false;
  if (file.size > rawTarget) {
    onStatus?.("Large Image - Compressing...");
    candidate = await compressImageToFit(file, rawTarget, compressOptions);
    wasCompressed = !!candidate && candidate !== file;
  }

  if (!candidate)
    return {
      error: `Image is too large and could not be compressed under ${maxSize / 1024}KB.`,
    };

  try {
    const content = await toDataURL(candidate);
    const fileMessage = JSON.stringify({
      type: "file",
      name: candidate.name,
      size: candidate.size,
      mimeType: candidate.type,
      content,
    });

    const byteLen = new Blob([fileMessage]).size;
    if (byteLen > maxSize) {
      return {
        error:
          "Encoded file data too large for a Kaspa transaction. Please use a smaller file.",
      };
    } else {
      if (wasCompressed) {
        onStatus?.("Compression Successful");
      }
      return { fileMessage, file: candidate };
    }
  } catch (e) {
    return {
      error: `Failed to read file: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

// Try multiple times to compress. reduce the quality for the first half of attempts, then reduce both for the remaining
async function compressImageToFit(
  file: File,
  rawTarget: number,
  options: CompressImageOptions
): Promise<File | null> {
  const {
    maxWidth = 256,
    maxHeight = 256,
    minWidth = 100,
    minHeight = 100,
    maxQuality = 1.0,
    minQuality = 0.4,
    maxAttempts = 10,
  } = options;

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const image = new Image();
    image.onload = () => res(image);
    image.onerror = rej;
    image.src = URL.createObjectURL(file);
  });

  let width = img.width;
  let height = img.height;
  let quality = maxQuality;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const compressed = await tryCompress(canvas, file, quality, rawTarget);

    if (compressed) return compressed;

    quality = Math.max(minQuality, quality - 0.1);

    if (attempt > maxAttempts / 2) {
      width = Math.max(minWidth, Math.round(width * 0.8));
      height = Math.max(minHeight, Math.round(height * 0.8));
    }
  }
  return null;
}

// Compresses once with given params
async function tryCompress(
  canvas: HTMLCanvasElement,
  original: File,
  quality: number,
  rawTarget: number
): Promise<File | null> {
  for (const type of ["image/webp", "image/jpeg"]) {
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, type, quality)
    );
    if (blob && blob.size <= rawTarget)
      return new File(
        [blob],
        original.name.replace(/\.[^.]+$/, `.${type.split("/")[1]}`),
        { type }
      );
  }
  return null;
}
