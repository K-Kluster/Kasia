import { derive_my_alias, derive_their_alias, PrivateKey } from "cipher";

/**
 * Derives my alias (the one I monitor for incoming messages).
 * Uses HKDF("chat" || shared_secret || my_public_key).
 *
 * The alias is computed using ECDH to create a shared secret, then HKDF with my public key
 * as context to derive a 6-byte (12 hex character) deterministic identifier.
 *
 * @param myPrivateKey - The private key string of the current user
 * @param theirAddress - The Kaspa address of the conversation partner
 * @returns A 12-character hex string representing my alias
 * @throws Error if the address is invalid or key derivation fails
 *
 * @example
 * ```typescript
 * const myAlias = deriveMyAlias(
 *   myPrivateKeyHex,
 *   "kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjceef60sd"
 * );
 * // Returns: "ab43efabf054" (12 hex chars)
 * ```
 */
export function deriveMyAlias(
  myPrivateKey: string,
  theirAddress: string
): string {
  try {
    const privateKey = new PrivateKey(myPrivateKey);
    return derive_my_alias(privateKey, theirAddress);
  } catch (error) {
    throw new Error(
      `Failed to derive my alias: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Derives their alias (the one I send messages to).
 * Uses HKDF("chat" || shared_secret || their_public_key).
 *
 * The alias is computed using ECDH to create a shared secret, then HKDF with their public key
 * as context to derive a 6-byte (12 hex character) deterministic identifier.
 *
 * @param myPrivateKey - The private key string of the current user
 * @param theirAddress - The Kaspa address of the conversation partner
 * @returns A 12-character hex string representing their alias
 * @throws Error if the address is invalid or key derivation fails
 *
 * @example
 * ```typescript
 * const theirAlias = deriveTheirAlias(
 *   myPrivateKeyHex,
 *   "kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjceef60sd"
 * );
 * // Returns: "5a4c42982de7" (12 hex chars)
 * ```
 */
export function deriveTheirAlias(
  myPrivateKey: string,
  theirAddress: string
): string {
  try {
    const privateKey = new PrivateKey(myPrivateKey);
    return derive_their_alias(privateKey, theirAddress);
  } catch (error) {
    throw new Error(
      `Failed to derive their alias: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Convenience function to derive both aliases at once.
 *
 * This ensures:
 * - My alias (what I monitor) uses my public key as context
 * - Their alias (where I send) uses their public key as context
 * - Privacy: Different aliases in each direction prevent on-chain linkage
 *
 * @param myPrivateKey - The private key string of the current user
 * @param theirAddress - The Kaspa address of the conversation partner
 * @returns Object containing both myAlias and theirAlias
 * @throws Error if the address is invalid or key derivation fails
 *
 * @example
 * ```typescript
 * const { myAlias, theirAlias } = deriveConversationAliases(
 *   myPrivateKeyHex,
 *   bobAddress
 * );
 * // Alice's myAlias !== Bob's myAlias (privacy!)
 * // Alice's theirAlias === Bob's myAlias (routing works!)
 * ```
 */
export function deriveConversationAliases(
  myPrivateKey: string,
  theirAddress: string
): { myAlias: string; theirAlias: string } {
  return {
    myAlias: deriveMyAlias(myPrivateKey, theirAddress),
    theirAlias: deriveTheirAlias(myPrivateKey, theirAddress),
  };
}
