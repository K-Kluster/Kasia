import {
  decrypt_message,
  decrypt_message_with_bytes,
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
  static log(...args: any[]): void {
    if (CipherHelper.DEBUG) {
      console.log(...args);
    }
  }

  /**
   * Error log function that only logs critical errors in production
   */
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
      // Parse the message manually
      const { nonce, ephemeralPublicKey, ciphertext } =
        CipherHelper.parseMessageComponents(encryptedHex);

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
   * Parse an encrypted message hex string into components
   *
   * @param encryptedHex - The hexadecimal string of the encrypted message
   * @returns Object with nonce, ephemeralPublicKey and ciphertext as hex strings
   */
  static parseMessageComponents(encryptedHex: string): {
    nonce: string;
    ephemeralPublicKey: string;
    ciphertext: string;
  } {
    if (!encryptedHex || encryptedHex.length < 24) {
      throw new Error("Invalid message format: too short or empty");
    }

    const nonce = encryptedHex.substring(0, 24);

    // Check if the key starts with 02 or 03 (compressed SEC1 format)
    const keyStart = encryptedHex.substring(24, 26);
    let epkEnd;
    if (keyStart === "02" || keyStart === "03") {
      // It's a compressed key, should be 33 bytes (66 hex chars)
      epkEnd = Math.min(24 + 66, encryptedHex.length);
      if (CipherHelper.DEBUG) {
        console.log("Detected compressed SEC1 format public key");
      }
    } else {
      // Use standard 32 bytes (64 hex chars) as fallback
      epkEnd = Math.min(24 + 64, encryptedHex.length);
    }

    const ephemeralPublicKey = encryptedHex.substring(24, epkEnd);
    const ciphertext = encryptedHex.substring(epkEnd);

    return {
      nonce,
      ephemeralPublicKey,
      ciphertext,
    };
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
