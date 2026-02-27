import { decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { LegacyMessage } from "../types/legacy";
import { Repositories } from "../store/repository/db";

// legacy storage key for backward compatibility
export const LEGACY_STORAGE_KEY = "kaspa_messages_by_wallet";

// legacy function for backward compatibility - loads all messages for a wallet
export function loadLegacyMessages(
  password: string
): Record<string, LegacyMessage[]> {
  const encrypted = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!encrypted) return {};
  try {
    const decrypted = decryptXChaCha20Poly1305(encrypted, password);
    return JSON.parse(decrypted);
  } catch {
    // try to parse as plaintext, sorta makes this backwards compatible
    try {
      return JSON.parse(encrypted);
    } catch {
      return {};
    }
  }
}

// reEncrypt all messages for a wallet when password changes
export async function reEncryptMessagesForWallet(
  walletId: string,
  repositories: Repositories,
  newPassword: string
): Promise<void> {
  try {
    await Promise.all([
      repositories.contactRepository.reEncrypt(newPassword),
      repositories.conversationRepository.reEncrypt(newPassword),
      repositories.handshakeRepository.reEncrypt(newPassword),
      repositories.messageRepository.reEncrypt(newPassword),
      repositories.paymentRepository.reEncrypt(newPassword),
      repositories.broadcastChannelRepository.reEncrypt(newPassword),
      repositories.blockedAddressRepository.reEncrypt(newPassword),
    ]);

    console.log(`Successfully reEncrypted messages for wallet ${walletId}`);
  } catch (error) {
    console.error("Error during message reEncryption:", error);
    throw new Error("Failed to reEncrypt messages with new password");
  }
}
