import {
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  Mnemonic,
  PrivateKeyGenerator,
  PublicKeyGenerator,
  XPrv,
} from "kaspa-wasm";

type StoredWallet = {
  encryptedPhrase: string;
  createdAt: string;
  accounts: { name: string }[];
};

export type UnlockedWallet = {
  activeAccount: 1;
  publicKeyGenerator: PublicKeyGenerator;
  encryptedXPrv: string;
  password: string;
};

export class WalletStorage {
  private _storageKey: string = "wallet";

  constructor() {}

  reset() {
    localStorage.removeItem(this._storageKey);
  }

  async getDecrypted(password: string): Promise<UnlockedWallet> {
    const walletString = localStorage.getItem(this._storageKey);
    if (walletString) {
      try {
        const wallet = JSON.parse(walletString) as StoredWallet;

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
          activeAccount: 1,
          encryptedXPrv: encryptXChaCha20Poly1305(
            extendedKey.toString(),
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
    throw new Error("Wallet not found");
  }

  static getPrivateKeyGenerator(
    unlockedWallet: UnlockedWallet,
    password: string
  ) {
    const privateKeyGenerator = new PrivateKeyGenerator(
      decryptXChaCha20Poly1305(unlockedWallet.encryptedXPrv, password),
      false,
      BigInt(1)
    );

    return privateKeyGenerator;
  }

  create(mnemonic: Mnemonic, password: string) {
    if (this.isInitialized()) {
      throw new Error("Wallet already exists");
    }

    const wallet = {
      encryptedPhrase: encryptXChaCha20Poly1305(mnemonic.phrase, password),
      createdAt: new Date().toISOString(),
      accounts: [{ name: "Account 1" }],
    };

    localStorage.setItem(this._storageKey, JSON.stringify(wallet));
  }

  isInitialized() {
    return !!localStorage.getItem(this._storageKey);
  }
}
