// Helper function to check if Kasware is available
export async function checkKaswareAvailability() {
  // Give the wallet some time to inject itself
  await new Promise((resolve) => setTimeout(resolve, 500));
  return typeof window.kasware !== "undefined";
}
