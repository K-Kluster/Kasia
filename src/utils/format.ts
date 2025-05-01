// Helper function to format KAS amount
export function formatKasAmount(amount: number) {
  // amount is already in KAS
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}
