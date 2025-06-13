import {
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  Mnemonic,
  PrivateKeyGenerator,
  PublicKeyGenerator,
  XPrv,
} from "kaspa-wasm";
import { KaspaClient } from "../utils/all-in-one";

type StoredWallet = {
  id: string;
  name: string;
  encryptedPhrase: string;
  createdAt: string;
  accounts: { name: string }[];
};

export type UnlockedWallet = {
  id: string;
  name: string;
  activeAccount: 1;
  publicKeyGenerator: PublicKeyGenerator;
  encryptedXPrv: string;
  password: string;
  client?: KaspaClient;
};

export class WalletStorage {
  private _storageKey: string = "wallets";

  constructor() {
    // Initialize wallets array if it doesn't exist
    if (!localStorage.getItem(this._storageKey)) {
      localStorage.setItem(this._storageKey, JSON.stringify([]));
    }
  }

  static getPrivateKeyGenerator(wallet: UnlockedWallet, password: string): PrivateKeyGenerator {
    try {
      // First decrypt the mnemonic phrase
      const seed = decryptXChaCha20Poly1305(wallet.encryptedXPrv, password);
      const xprv = new XPrv(seed);
      return new PrivateKeyGenerator(xprv, false, BigInt(1));
    } catch (error) {
      console.error("Error getting private key generator:", error);
      throw new Error("Invalid password");
    }
  }

  /**
   * Helper function to get bytes from a private key. Will try several common methods
   * found in different wallet implementations to extract the raw bytes.
   * 
   * @param privateKey - The private key object to extract bytes from
   * @returns Uint8Array of the private key bytes, or null if no method succeeded
   */
  static getPrivateKeyBytes(privateKey: any): Uint8Array | null {
    try {
      // Try method 1: secret_bytes (used by k256 library)
      if (typeof privateKey.secret_bytes === 'function') {
        return privateKey.secret_bytes();
      }
      
      // Try method 2: to_bytes (common in some wallet implementations)
      if (typeof privateKey.to_bytes === 'function') {
        return privateKey.to_bytes();
      }
      
      // Try method 3: bytes (seen in some implementations)
      if (typeof privateKey.bytes === 'function') {
        return privateKey.bytes();
      }
      
      // Try method 4: serialized bytes
      if (typeof privateKey.serialize === 'function') {
        return privateKey.serialize();
      }

      // If all else fails but we have a toString method that gives hex,
      // try to convert it to bytes
      if (typeof privateKey.toString === 'function') {
        const hexString = privateKey.toString();
        if (hexString && hexString.match(/^[0-9a-fA-F]+$/)) {
          return new Uint8Array(
            hexString.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
          );
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error getting private key bytes:", error);
      return null;
    }
  }

  getWalletList(): { id: string; name: string; createdAt: string }[] {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return [];
    const wallets = JSON.parse(walletsString) as StoredWallet[];
    return wallets.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
  }

  async getDecrypted(walletId: string, password: string): Promise<UnlockedWallet> {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("No wallets found");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const wallet = wallets.find(w => w.id === walletId);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    try {
      // First decrypt the mnemonic phrase
        const mnemonic = new Mnemonic(
          decryptXChaCha20Poly1305(wallet.encryptedPhrase, password)
        );
      
      // Generate the seed and extended private key
      const seed = mnemonic.toSeed();
      const extendedKey = new XPrv(seed);
      
      // Get the public key generator
        const publicKeyGenerator = await PublicKeyGenerator.fromMasterXPrv(
          extendedKey,
          false,
          BigInt(1)
        );

      // Create the unlocked wallet with the encrypted seed
        return {
        id: wallet.id,
        name: wallet.name,
          activeAccount: 1,
        encryptedXPrv: encryptXChaCha20Poly1305(seed, password),
          publicKeyGenerator,
          password,
        };
      } catch (error) {
      console.error("Error decrypting wallet:", error);
        throw new Error("Invalid password");
      }
    }

  create(name: string, mnemonic: Mnemonic, password: string): string {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("Storage not initialized");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    
    const newWallet: StoredWallet = {
      id: crypto.randomUUID(),
      name,
      encryptedPhrase: encryptXChaCha20Poly1305(mnemonic.phrase, password),
      createdAt: new Date().toISOString(),
      accounts: [{ name: "Account 1" }],
    };

    wallets.push(newWallet);
    localStorage.setItem(this._storageKey, JSON.stringify(wallets));
    return newWallet.id;
  }

  deleteWallet(walletId: string) {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return;

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const updatedWallets = wallets.filter(w => w.id !== walletId);
    localStorage.setItem(this._storageKey, JSON.stringify(updatedWallets));
  }

  isInitialized() {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return false;
    const wallets = JSON.parse(walletsString) as StoredWallet[];
    return wallets.length > 0;
  }
}
