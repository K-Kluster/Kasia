import { createStore } from "zustand";
import { KasiaDB, openDatabase, Repositories } from "./repository/db";

interface DBState {
  db: KasiaDB | undefined;
  isDbOpening: boolean;
  repositories: Repositories | undefined;
  initDB: () => Promise<void>;
  initRepositories: (tenantId: string) => void;
}

export const useDBStore = createStore<DBState>((set, get) => ({
  db: undefined,
  isDbOpening: false,
  repositories: undefined,
  initDB: async () => {
    const db = await openDatabase();
    set({ db });
  },
  initRepositories: (tenantId: string) => {
    const db = get().db;
    if (!db) {
      throw new Error("DB not initialized");
    }

    const repositories = new Repositories(tenantId, db);
    set({ repositories });
  },
}));
