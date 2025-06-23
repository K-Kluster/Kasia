// Helper function to format KAS amount
export function formatKasAmount(amount: number, isSompi: boolean = false) {
  // Convert from sompi to KAS if needed
  const kasAmount = isSompi ? amount / 100000000 : amount;

  return Number(kasAmount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}
