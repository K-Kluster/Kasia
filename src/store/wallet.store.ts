import { create } from "zustand";
import { KaspaClient } from "../utils/all-in-one";
import { UnlockedWallet, WalletStorage } from "../utils/wallet-storage";
import { Address, Mnemonic, UtxoEntryReference } from "kaspa-wasm";
import { AccountService } from "../service/account-service";

type WalletState = {
  doesExists: boolean;
  unlockedWallet: UnlockedWallet | null;
  address: Address | null;
  balance: number | null;
  rpcClient: KaspaClient | null;
  isAccountServiceRunning: boolean;

  // wallet storage
  create: (mnemonic: Mnemonic, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;

  // wallet x accounts
  start: (
    rpcClient: KaspaClient,
    unlockedWallet: UnlockedWallet
  ) => Promise<{ receiveAddress: Address }>;
  stop: () => void;

  sendMessage: (
    message: string,
    toAddress: Address,
    password: string
  ) => Promise<string>;

  getMatureUtxos: () => UtxoEntryReference[];

  /// warning: this will remove all data from the store
  flush: () => void;
};

export const useWalletStore = create<WalletState>((set, g) => {
  const _walletStorage = new WalletStorage();

  let _accountService: AccountService | null = null;

  return {
    doesExists: _walletStorage.isInitialized(),
    unlockedWallet: null,
    address: null,
    balance: null,
    rpcClient: null,
    isAccountServiceRunning: false,
    create: async (mnemonic: Mnemonic, password: string) => {
      _walletStorage.create(mnemonic, password);
      set({ doesExists: true });
      await g().unlock(password);
    },
    unlock: async (password: string) => {
      const unlockedWallet = await _walletStorage.getDecrypted(password);

      set({ unlockedWallet });
    },
    lock: () => {
      set({ unlockedWallet: null, address: null, balance: null });
    },
    start: async (rpcClient: KaspaClient) => {
      const { unlockedWallet } = g();
      if (!unlockedWallet) {
        throw new Error("Wallet not unlocked");
      }

      _accountService = new AccountService(rpcClient, unlockedWallet);
      await _accountService.start();

      _accountService.on("balance", (balance) => {
        set({ balance });
      });

      // @TODO, in another service
      // const prefix = "ciph_msg:"
      //   .split("")
      //   .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      //   .join("");

      // rpcClient.rpc?.addEventListener(
      //   "block-added",
      //   (blockAdded: IBlockAdded) => {
      //     const data = blockAdded as BlockAddedData;
      //     const cipheredTxs = data.data.block.transactions.filter((t) => {
      //       return t.payload.startsWith(prefix);
      //     });

      //     if (cipheredTxs.length) {
      //       console.log(cipheredTxs);
      //     }
      //   }
      // );
      // rpcClient.rpc?.subscribeBlockAdded();

      set({
        rpcClient,
        address: _accountService.receiveAddress,
        isAccountServiceRunning: true,
      });

      return { receiveAddress: _accountService.receiveAddress! };
    },
    sendMessage(message, toAddress, password) {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.sendMessage({ message, toAddress, password });
    },
    getMatureUtxos() {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.getMatureUtxos();
    },
    stop: () => {
      if (_accountService) {
        _accountService.stop();
        _accountService = null;
      }

      set({ rpcClient: null, address: null, isAccountServiceRunning: false });
    },
    flush: () => {
      _walletStorage.reset();
      set({
        doesExists: false,
      });

      g().lock();
    },
  };
});
