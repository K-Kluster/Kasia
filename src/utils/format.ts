// Helper function to format KAS amount
export function formatKasAmount(amount: number, isSompi: boolean = false) {
  // Convert from sompi to KAS if needed
  const kasAmount = isSompi ? amount / 100000000 : amount;

  return Number(kasAmount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function decodePayload(hex: string) {
  try {
    if (!hex) return "No payload";
    // Convert hex to text
    const text = hex
      .match(/.{1,2}/g)
      ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
      .join("");
    // Check if the text is printable ASCII
    if (/^[\x20-\x7E]*$/.test(text ?? "N/A")) {
      return text;
    }
    return `Hex: ${hex}`;
  } catch (e) {
    console.error("Error decoding payload:", e);
    return `Hex: ${hex}`;
  }
}
