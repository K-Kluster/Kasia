import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { Message } from "../types/all";

const STORAGE_KEY = "kaspa_messages_by_wallet";

export function saveMessages(
  messages: Record<string, Message[]>,
  password: string
) {
  const encrypted = encryptXChaCha20Poly1305(
    JSON.stringify(messages),
    password
  );
  localStorage.setItem(STORAGE_KEY, encrypted);
}

export function loadMessages(password: string): Record<string, Message[]> {
  const encrypted = localStorage.getItem(STORAGE_KEY);
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
