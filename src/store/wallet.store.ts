import { create } from "zustand";
import { KaspaClient } from "../utils/all-in-one";
import { UnlockedWallet, WalletStorage } from "../utils/wallet-storage";
import { Address, Mnemonic, UtxoEntryReference } from "kaspa-wasm";
import { AccountService } from "../service/account-service";

type WalletState = {
  wallets: { id: string; name: string; createdAt: string }[];
  selectedWalletId: string | null;
  unlockedWallet: UnlockedWallet | null;
  address: Address | null;
  balance: number | null;
  rpcClient: KaspaClient | null;
  isAccountServiceRunning: boolean;

  // wallet management
  loadWallets: () => void;
  selectWallet: (walletId: string) => void;
  createWallet: (name: string, mnemonic: Mnemonic, password: string) => Promise<string>;
  deleteWallet: (walletId: string) => void;
  unlock: (walletId: string, password: string) => Promise<void>;
  lock: () => void;

  // wallet operations
  start: (rpcClient: KaspaClient) => Promise<{ receiveAddress: Address }>;
  stop: () => void;
  sendMessage: (message: string, toAddress: Address, password: string) => Promise<string>;
  getMatureUtxos: () => UtxoEntryReference[];
};

export const useWalletStore = create<WalletState>((set, get) => {
  const _walletStorage = new WalletStorage();
  let _accountService: AccountService | null = null;

  return {
    wallets: [],
    selectedWalletId: null,
    unlockedWallet: null,
    address: null,
    balance: null,
    rpcClient: null,
    isAccountServiceRunning: false,

    loadWallets: () => {
      const wallets = _walletStorage.getWalletList();
      set({ wallets });
    },

    selectWallet: (walletId: string) => {
      set({ selectedWalletId: walletId });
    },

    createWallet: async (name: string, mnemonic: Mnemonic, password: string) => {
      const walletId = _walletStorage.create(name, mnemonic, password);
      get().loadWallets();
      return walletId;
    },

    deleteWallet: (walletId: string) => {
      _walletStorage.deleteWallet(walletId);
      get().loadWallets();
      if (get().selectedWalletId === walletId) {
        get().lock();
      }
    },

    unlock: async (walletId: string, password: string) => {
      const unlockedWallet = await _walletStorage.getDecrypted(walletId, password);
      set({ unlockedWallet });
    },

    lock: () => {
      if (_accountService) {
        _accountService.stop();
        _accountService = null;
      }
      set({
        unlockedWallet: null,
        address: null,
        balance: null,
        rpcClient: null,
        isAccountServiceRunning: false
      });
    },

    start: async (rpcClient: KaspaClient) => {
      const { unlockedWallet } = get();
      if (!unlockedWallet) {
        throw new Error("Wallet not unlocked");
      }

      _accountService = new AccountService(rpcClient, unlockedWallet);
      await _accountService.start();

      _accountService.on("balance", (balance) => {
        set({ balance });
      });

      set({
        rpcClient,
        address: _accountService.receiveAddress,
        isAccountServiceRunning: true,
      });

      return { receiveAddress: _accountService.receiveAddress! };
    },

    stop: () => {
      if (_accountService) {
        _accountService.stop();
        _accountService = null;
      }

      set({ rpcClient: null, address: null, isAccountServiceRunning: false });
    },

    sendMessage: (message, toAddress, password) => {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.sendMessage({ message, toAddress, password });
    },

    getMatureUtxos: () => {
      if (!_accountService) {
        console.log('WalletStore - Account service not initialized');
        throw Error("Account service not initialized.");
      }
      const utxos = _accountService.getMatureUtxos();
      console.log('WalletStore - getMatureUtxos result:', {
        count: utxos.length,
        utxos: utxos
      });
      return utxos;
    }
  };
});
