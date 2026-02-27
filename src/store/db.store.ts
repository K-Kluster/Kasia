import { create } from "zustand";
import { KasiaDB, openDatabase, Repositories } from "./repository/db";
import { UnlockedWallet } from "../types/wallet.type";

interface DBState {
  db: KasiaDB | undefined;
  isDbOpening: boolean;
  repositories: Repositories;
  unlockedWallet: UnlockedWallet;

  /**
   * Opens the database (indexdb) and sets the `db` state
   */
  initDB: () => Promise<void>;
  /**
   * @param unlockedWallet wallet
   * @param walletPassword used for encryption and decription of locally stored sensitive data
   */
  initRepositories: (unlockedWallet: UnlockedWallet) => void;
}

export const useDBStore = create<DBState>((set, get) => ({
  db: undefined,
  isDbOpening: false,
  repositories: undefined!,
  unlockedWallet: undefined!,

  initDB: async () => {
    const db = await openDatabase();

    set({ db });
  },
  initRepositories: (unlockedWallet) => {
    const db = get().db;
    if (!db) {
      throw new Error("DB not initialized");
    }

    if (!unlockedWallet?.id || !unlockedWallet.password) {
      throw new Error("Tenant ID and wallet password are required");
    }

    const repositories = new Repositories(
      db,
      unlockedWallet.password,
      unlockedWallet.id
    );
    set({ repositories, unlockedWallet });
  },
}));
