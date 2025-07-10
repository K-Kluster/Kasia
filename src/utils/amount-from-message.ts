import { formatKasAmount } from "./format";

// Helper function to calculate minimum required amount based on message length
export function amountFromMessage(message: string) {
  // Constants for fee calculation (all values in sompi)
  const MIN_OUTPUT_VALUE = 20000000; // 0.2 KAS minimum output value
  const MIN_RELAY_FEE = 100000; // 0.001 KAS minimum relay fee
  const DEFAULT_FEE_PER_MASS = 100; // 100 sompi per mass unit
  const MASS_MULTIPLIER = 10; // Mass multiplier for safety

  try {
    // Calculate message bytes
    const messageBytes = new TextEncoder().encode(message).length;

    // Calculate mass based on message length with safety multiplier
    const baseMass = 300; // Base transaction mass
    const messageMass = messageBytes * MASS_MULTIPLIER; // Higher mass per byte
    const totalMass = baseMass + messageMass;

    // Calculate minimum fee based on mass
    const massFee = Math.ceil(totalMass * DEFAULT_FEE_PER_MASS);
    const minFee = Math.max(massFee, MIN_RELAY_FEE);

    // Calculate total amount (minimum output + fees)
    const totalAmount = MIN_OUTPUT_VALUE + minFee;

    // Add 10% buffer for safety
    const finalAmount = Math.ceil(totalAmount * 1.1);

    // Log the calculation details
    console.log("Fee calculation:", {
      messageLength: messageBytes,
      messageMass,
      baseMass,
      totalMass,
      massFee,
      minFee,
      minOutputValue: MIN_OUTPUT_VALUE,
      totalBeforeBuffer: totalAmount,
      finalAmount,
      kasAmount: formatKasAmount(finalAmount),
    });

    return finalAmount;
  } catch (error) {
    console.error("Error in fee calculation:", error);
    // Fallback to minimum output value plus fees
    const fallbackAmount = MIN_OUTPUT_VALUE + MIN_RELAY_FEE;
    const finalAmount = Math.ceil(fallbackAmount * 1.1);
    console.log("Using fallback amount:", finalAmount, "sompi");
    return finalAmount;
  }
}
