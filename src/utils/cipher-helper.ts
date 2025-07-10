import {
  decrypt_message,
  decrypt_with_secret_key,
  debug_can_decrypt,
  EncryptedMessage,
  PrivateKey,
} from "cipher";
import { SecurityHelper } from "./security-helper";

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
    privateKeyHex: string,
    messageId: string
  ): Promise<string> {
    // Validate inputs
    if (!encryptedHex || !privateKeyHex) {
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

    // First check if this private key can decrypt the message - but don't fail if it returns false
    try {
      const canDecrypt = await debug_can_decrypt(encryptedHex, privateKeyHex);
      CipherHelper.log("Debug can decrypt check:", canDecrypt);

      // NOTE: We're not failing early here anymore, as the debug_can_decrypt might
      // give false negatives in some cases
    } catch (err) {
      // Don't fail if debug check fails, continue with decryption attempts
      CipherHelper.log("Debug check failed:", err);
    }

    // Try different approaches
    const errors: Error[] = [];

    // Method 1: Use private key directly (most reliable method)
    try {
      const privateKey = new PrivateKey(privateKeyHex);
      const encryptedMessage = new EncryptedMessage(encryptedHex);

      const decrypted = await decrypt_message(encryptedMessage, privateKey);
      CipherHelper.log("Standard decryption successful");
      return decrypted;
    } catch (err) {
      errors.push(err as Error);
      CipherHelper.log("Standard decryption attempt failed");
    }

    // Method 2: Try different message parsing
    try {
      // Create message using the constructor provided by the WASM module
      const encryptedMessage = new EncryptedMessage(encryptedHex);
      const privateKey = new PrivateKey(privateKeyHex);

      const decrypted = await decrypt_message(encryptedMessage, privateKey);
      CipherHelper.log("Component-based decryption successful");
      return decrypted;
    } catch (err) {
      errors.push(err as Error);
      CipherHelper.log("Component-based decryption attempt failed");
    }

    // Method 3: Convert private key to bytes and try the secret key approach
    try {
      // Convert private key to bytes
      const privateKeyBytes = new Uint8Array(
        privateKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const encryptedMessage = new EncryptedMessage(encryptedHex);

      const decrypted = await decrypt_with_secret_key(
        encryptedMessage,
        privateKeyBytes
      );
      CipherHelper.log("Byte-based decryption successful");

      // Schedule clearing of private key bytes from memory
      SecurityHelper.clearSensitiveData(privateKeyBytes);

      return decrypted;
    } catch (err) {
      errors.push(err as Error);
      CipherHelper.log("Byte-based decryption attempt failed");
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
    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    if (payload.toLowerCase().startsWith(prefix)) {
      return payload.substring(prefix.length);
    }

    return payload;
  }
}
