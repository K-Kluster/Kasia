import { CipherHelper } from "./cipher-helper";

/**
 * Security helper class for managing sensitive operations
 */
export class SecurityHelper {
  private static decryptionAttempts: Map<string, number> = new Map();
  private static lastDecryptionTime: Map<string, number> = new Map();
  private static readonly MAX_ATTEMPTS = 50; // Max attempts per message
  private static readonly RATE_LIMIT_MS = 100; // Minimum time between attempts
  private static readonly ATTEMPT_RESET_MS = 60000; // Reset attempts after 1 minute
  private static readonly MEMORY_CLEAR_DELAY_MS = 30000; // Clear sensitive data after 30 seconds

  /**
   * Check if decryption attempts are allowed for a message
   */
  static canAttemptDecryption(messageId: string): boolean {
    const now = Date.now();
    const attempts = this.decryptionAttempts.get(messageId) || 0;
    const lastAttempt = this.lastDecryptionTime.get(messageId) || 0;

    // Reset attempts if enough time has passed
    if (now - lastAttempt > this.ATTEMPT_RESET_MS) {
      this.decryptionAttempts.set(messageId, 0);
      return true;
    }

    // Check rate limiting
    if (now - lastAttempt < this.RATE_LIMIT_MS) {
      CipherHelper.log(`Rate limit hit for message ${messageId}`);
      return false;
    }

    // Check max attempts
    if (attempts >= this.MAX_ATTEMPTS) {
      CipherHelper.error(
        `Max decryption attempts reached for message ${messageId}`
      );
      return false;
    }

    return true;
  }

  /**
   * Record a decryption attempt for a message
   */
  static recordDecryptionAttempt(messageId: string): void {
    const attempts = this.decryptionAttempts.get(messageId) || 0;
    this.decryptionAttempts.set(messageId, attempts + 1);
    this.lastDecryptionTime.set(messageId, Date.now());
  }

  /**
   * Clear sensitive data from memory
   */
  static clearSensitiveData(privateKeyBytes: Uint8Array): void {
    // Schedule clearing of private key data
    setTimeout(() => {
      if (privateKeyBytes) {
        privateKeyBytes.fill(0); // Overwrite with zeros
        CipherHelper.log("Cleared sensitive private key data from memory");
      }
    }, this.MEMORY_CLEAR_DELAY_MS);
  }

  /**
   * Get stats about decryption attempts
   */
  static getDecryptionStats(messageId: string): {
    attempts: number;
    remainingAttempts: number;
    timeUntilReset: number;
  } {
    const attempts = this.decryptionAttempts.get(messageId) || 0;
    const lastAttempt = this.lastDecryptionTime.get(messageId) || 0;
    const now = Date.now();

    return {
      attempts,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - attempts),
      timeUntilReset: Math.max(0, this.ATTEMPT_RESET_MS - (now - lastAttempt)),
    };
  }
}
