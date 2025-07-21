import { create } from "zustand";
import { KasiaDB, openDatabase, Repositories } from "./repository/db";

interface DBState {
  db: KasiaDB | undefined;
  isDbOpening: boolean;
  repositories: Repositories;
  /**
   * Opens the database (indexdb) and sets the `db` state
   */
  initDB: () => Promise<void>;
  /**
   * @param tenantId wallet tenant id
   * @param walletPassword used for encryption and decription of locally stored sensitive data
   */
  initRepositories: (tenantId: string, walletPassword: string) => void;
}

export const useDBStore = create<DBState>((set, get) => ({
  db: undefined,
  isDbOpening: false,
  repositories: undefined!,
  initDB: async () => {
    const db = await openDatabase();
    set({ db });
  },
  initRepositories: (tenantId, walletPassword) => {
    const db = get().db;
    if (!db) {
      throw new Error("DB not initialized");
    }

    if (!tenantId || !walletPassword) {
      throw new Error("Tenant ID and wallet password are required");
    }

    const repositories = new Repositories(db, tenantId, walletPassword);
    set({ repositories });
  },
}));
