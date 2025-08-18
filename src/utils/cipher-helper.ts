import { decrypt_message, EncryptedMessage, PrivateKey } from "cipher";
import { SecurityHelper } from "./security-helper";
import { PROTOCOL } from "../config/protocol";

/**
 * Helper functions for working with cipher encryption/decryption
 */
export class CipherHelper {
  // Production mode - debug logs disabled
  static DEBUG = false;

  /**
   * Safe log function that only logs in debug mode
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static log(...args: any[]): void {
    if (CipherHelper.DEBUG) {
      console.log(...args);
    }
  }

  /**
   * Error log function that only logs critical errors in production
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static error(...args: any[]): void {
    if (
      args[0]?.includes(
        "Failed to decrypt with both receive and change keys"
      ) ||
      args[0]?.includes("Cipher module not initialized properly") ||
      args[0]?.includes("Invalid input")
    ) {
      console.error(...args);
    } else if (CipherHelper.DEBUG) {
      console.error(...args);
    }
  }

  /**
   * Validates that the WASM module is properly initialized
   * @returns True if initialized, false otherwise
   */
  static ensureWasmInitialized(): boolean {
    try {
      // Check if cipher module is available and properly initialized
      if (
        typeof EncryptedMessage !== "function" ||
        typeof PrivateKey !== "function"
      ) {
        CipherHelper.error("Cipher WASM module not properly initialized");
        return false;
      }
      return true;
    } catch (err) {
      CipherHelper.error("Error checking WASM initialization:", err);
      return false;
    }
  }

  /**
   * Attempts to decrypt a message with multiple approaches
   *
   * @param encryptedHex - The hexadecimal string of the encrypted message
   * @param privateKeyHex - The hexadecimal string of the private key
   * @param messageId - Unique identifier for the message (for rate limiting)
   * @returns The decrypted message if successful
   * @throws Error if decryption fails
   */
  static async tryDecrypt(
    encryptedHex: string,
    privateKeyString: string,
    messageId: string
  ): Promise<string> {
    // Validate inputs
    if (!encryptedHex || !privateKeyString) {
      throw new Error(
        "Invalid input: encrypted message and private key are required"
      );
    }

    // Check rate limiting and attempt tracking
    if (!SecurityHelper.canAttemptDecryption(messageId)) {
      throw new Error(
        "Decryption attempts rate limited or maximum attempts reached"
      );
    }

    if (!CipherHelper.ensureWasmInitialized()) {
      throw new Error("Cipher module not initialized properly");
    }

    // Record this attempt
    SecurityHelper.recordDecryptionAttempt(messageId);

    // Try different approaches
    const errors: Error[] = [];

    // Method 1: Use private key directly (most reliable method)
    try {
      const privateKey = new PrivateKey(privateKeyString);
      const encryptedMessage = new EncryptedMessage(encryptedHex);

      const decrypted = await decrypt_message(encryptedMessage, privateKey);
      CipherHelper.log("Standard decryption successful");
      return decrypted;
    } catch (err) {
      errors.push(err as Error);
      CipherHelper.log("Standard decryption attempt failed");
    }

    // Log decryption stats only in debug mode
    if (CipherHelper.DEBUG) {
      const stats = SecurityHelper.getDecryptionStats(messageId);
      CipherHelper.log(`Decryption stats for message ${messageId}:`, stats);
    }

    // Detailed error to help diagnose issues
    const errorDetails = errors
      .map((err, i) => `Method ${i + 1}: ${err.message || err}`)
      .join("; ");
    throw new Error(`All decryption methods failed: ${errorDetails}`);
  }

  /**
   * Strips the cipher message prefix if present
   *
   * @param payload - The full message payload possibly including prefix
   * @returns The hex string without prefix
   */
  static stripPrefix(payload: string): string {
    const prefix = PROTOCOL.prefix.string
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    if (payload.toLowerCase().startsWith(prefix)) {
      return payload.substring(prefix.length);
    }

    return payload;
  }
}
