import {
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  Mnemonic,
  PrivateKeyGenerator,
  PublicKeyGenerator,
  XPrv,
} from "kaspa-wasm";

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
      const seed = decryptXChaCha20Poly1305(wallet.encryptedXPrv, password);
      const xprv = new XPrv(seed);
      return new PrivateKeyGenerator(xprv, false, BigInt(1));
    } catch (error) {
      console.error(error);
      throw new Error("Invalid password");
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
        const mnemonic = new Mnemonic(
          decryptXChaCha20Poly1305(wallet.encryptedPhrase, password)
        );
        const extendedKey = new XPrv(mnemonic.toSeed());
        const publicKeyGenerator = await PublicKeyGenerator.fromMasterXPrv(
          extendedKey,
          false,
          BigInt(1)
        );

        return {
        id: wallet.id,
        name: wallet.name,
          activeAccount: 1,
          encryptedXPrv: encryptXChaCha20Poly1305(
          mnemonic.toSeed(),
            password
          ),
          publicKeyGenerator,
          password,
        };
      } catch (error) {
        console.error(error);
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
