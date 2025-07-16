import {
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  Mnemonic,
  PrivateKeyGenerator,
  PublicKeyGenerator,
  XPrv,
} from "kaspa-wasm";
import { v4 as uuidv4 } from "uuid";
import {
  StoredWallet,
  UnlockedWallet,
  WalletDerivationType,
} from "src/types/wallet.type";

export class WalletStorage {
  private _storageKey: string = "wallets";

  constructor() {
    // Initialize wallets array if it doesn't exist
    if (!localStorage.getItem(this._storageKey)) {
      localStorage.setItem(this._storageKey, JSON.stringify([]));
    }
  }

  static getPrivateKeyGenerator(
    wallet: UnlockedWallet,
    password: string
  ): PrivateKeyGenerator {
    try {
      // First decrypt the mnemonic phrase
      const seed = decryptXChaCha20Poly1305(wallet.encryptedXPrv, password);
      const xprv = new XPrv(seed);

      // Use derivation type to determine account index
      return new PrivateKeyGenerator(
        xprv,
        false,
        BigInt(wallet.derivationType === "standard" ? 0 : 1)
      );
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
  static getPrivateKeyBytes(privateKey: unknown): Uint8Array | null {
    try {
      if (!(typeof privateKey === "object") || privateKey === null) {
        return null;
      }
      // Try method 1: secret_bytes (used by k256 library)
      if (
        "secret_bytes" in privateKey &&
        typeof privateKey.secret_bytes === "function"
      ) {
        return privateKey.secret_bytes();
      }

      // Try method 2: to_bytes (common in some wallet implementations)
      if (
        "to_bytes" in privateKey &&
        typeof privateKey.to_bytes === "function"
      ) {
        return privateKey.to_bytes();
      }

      // Try method 3: bytes (seen in some implementations)
      if ("bytes" in privateKey && typeof privateKey.bytes === "function") {
        return privateKey.bytes();
      }

      // Try method 4: serialized bytes
      if (
        "serialize" in privateKey &&
        typeof privateKey.serialize === "function"
      ) {
        return privateKey.serialize();
      }

      // If all else fails but we have a toString method that gives hex,
      // try to convert it to bytes
      if (typeof privateKey.toString === "function") {
        const hexString = privateKey.toString();
        if (hexString && hexString.match(/^[0-9a-fA-F]+$/)) {
          return new Uint8Array(
            hexString
              .match(/.{1,2}/g)
              ?.map((byte: string) => parseInt(byte, 16)) || []
          );
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting private key bytes:", error);
      return null;
    }
  }

  getWalletList(): {
    id: string;
    name: string;
    createdAt: string;
    derivationType?: WalletDerivationType;
  }[] {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return [];
    const wallets = JSON.parse(walletsString) as StoredWallet[];
    return wallets.map(({ id, name, createdAt, derivationType }) => ({
      id,
      name,
      createdAt,
      derivationType: derivationType || "legacy", // Default to legacy for existing wallets
    }));
  }

  async getDecrypted(
    walletId: string,
    password: string
  ): Promise<UnlockedWallet> {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("No wallets found");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const wallet = wallets.find((w) => w.id === walletId);

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

      // Determine derivation type (default to legacy for existing wallets)
      const derivationType: WalletDerivationType =
        wallet.derivationType || "legacy";

      // Get the public key generator - use original working approach
      const publicKeyGenerator = await PublicKeyGenerator.fromMasterXPrv(
        extendedKey,
        false,
        BigInt(derivationType === "standard" ? 0 : 1)
      );

      // Create the unlocked wallet with the encrypted seed
      return {
        id: wallet.id,
        name: wallet.name,
        activeAccount: 1,
        encryptedXPrv: encryptXChaCha20Poly1305(seed, password),
        publicKeyGenerator,
        password,
        derivationType,
      };
    } catch (error) {
      console.error("Error decrypting wallet:", error);
      throw new Error("Invalid password");
    }
  }

  create(
    name: string,
    mnemonic: Mnemonic,
    password: string,
    derivationType: WalletDerivationType = "standard"
  ): string {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("Storage not initialized");

    const wallets = JSON.parse(walletsString) as StoredWallet[];

    const newWallet: StoredWallet = {
      id: uuidv4(),
      name,
      encryptedPhrase: encryptXChaCha20Poly1305(mnemonic.phrase, password),
      createdAt: new Date().toISOString(),
      accounts: [{ name: "Account 1" }],
      derivationType, // New wallets default to standard
    };

    wallets.push(newWallet);
    localStorage.setItem(this._storageKey, JSON.stringify(wallets));
    return newWallet.id;
  }

  deleteWallet(walletId: string) {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return;

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const updatedWallets = wallets.filter((w) => w.id !== walletId);
    localStorage.setItem(this._storageKey, JSON.stringify(updatedWallets));
  }

  isInitialized() {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) return false;
    const wallets = JSON.parse(walletsString) as StoredWallet[];
    return wallets.length > 0;
  }

  /**
   * Migrate an existing legacy wallet to standard derivation
   * This creates a new wallet with standard derivation using the same seed
   */
  async migrateLegacyWallet(
    walletId: string,
    password: string,
    newName?: string
  ): Promise<string> {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("No wallets found");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const wallet = wallets.find((w) => w.id === walletId);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.derivationType === "standard") {
      throw new Error("Wallet is already using standard derivation");
    }

    try {
      // Decrypt the existing mnemonic
      const mnemonicPhrase = decryptXChaCha20Poly1305(
        wallet.encryptedPhrase,
        password
      );
      const mnemonic = new Mnemonic(mnemonicPhrase);

      // Create new wallet with standard derivation
      const migrationName = newName || `${wallet.name} (Standard)`;
      return this.create(migrationName, mnemonic, password, "standard");
    } catch (error) {
      console.error("Error migrating wallet:", error);
      throw new Error("Failed to migrate wallet");
    }
  }

  /**
   * Change the password for an existing wallet
   */
  async changePassword(
    walletId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("No wallets found");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const walletIndex = wallets.findIndex((w) => w.id === walletId);

    if (walletIndex === -1) {
      throw new Error("Wallet not found");
    }

    const wallet = wallets[walletIndex];

    try {
      // First verify the current password by decrypting the mnemonic
      const mnemonicPhrase = decryptXChaCha20Poly1305(
        wallet.encryptedPhrase,
        currentPassword
      );

      // Re-encrypt with the new password
      const newEncryptedPhrase = encryptXChaCha20Poly1305(
        mnemonicPhrase,
        newPassword
      );

      // Create a copy of wallets and update the encrypted phrase
      const updatedWallets = [...wallets];
      updatedWallets[walletIndex] = {
        ...wallet,
        encryptedPhrase: newEncryptedPhrase,
      };

      // Save to localStorage first - if this fails, original state is preserved
      localStorage.setItem(this._storageKey, JSON.stringify(updatedWallets));
    } catch (error) {
      console.error("Error changing password:", error);
      throw new Error("Invalid current password");
    }
  }

  /**
   * Change the name of an existing wallet
   */
  changeWalletName(walletId: string, newName: string): void {
    const walletsString = localStorage.getItem(this._storageKey);
    if (!walletsString) throw new Error("No wallets found");

    const wallets = JSON.parse(walletsString) as StoredWallet[];
    const walletIndex = wallets.findIndex((w) => w.id === walletId);

    if (walletIndex === -1) {
      throw new Error("Wallet not found");
    }

    // Check if name already exists (excluding current wallet)
    const nameExists = wallets.some(
      (w, index) =>
        index !== walletIndex && w.name.toLowerCase() === newName.toLowerCase()
    );

    if (nameExists) {
      throw new Error("A wallet with this name already exists");
    }

    // Create a copy of wallets and update the name
    const updatedWallets = [...wallets];
    updatedWallets[walletIndex] = {
      ...wallets[walletIndex],
      name: newName.trim(),
    };

    // Save to localStorage first - if this fails, original state is preserved
    localStorage.setItem(this._storageKey, JSON.stringify(updatedWallets));
  }
}
