// Helper function to format KAS amount
export function formatKasAmount(somrat: number) {
  // Convert somrat (smallest unit) to KAS
  const amount = Number(somrat) / 100000000;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}
