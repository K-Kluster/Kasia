import { create } from "zustand";
import { WalletStorageService } from "../service/wallet-storage-service";
import {
  Address,
  GeneratorSummary,
  Mnemonic,
  NetworkId,
  RpcClient,
  sompiToKaspaString,
  UtxoEntryReference,
} from "kaspa-wasm";
import { AccountService } from "../service/account-service";
import { encrypt_message } from "cipher";
import { NetworkType } from "../types/all";
import { UnlockedWallet, WalletBalance } from "../types/wallet.type";
import { TransactionId } from "../types/transactions";
import { PriorityFeeConfig } from "../types/all";
import { FEE_ESTIMATE_POLLING_INTERVAL_IN_MS } from "../config/constants";

export interface WalletStoreSendMessageArgs {
  /**
   * message to send, prefix will be added automatically
   */
  message: string;
  toAddress: Address;
  customAmount?: bigint;
  priorityFee?: PriorityFeeConfig;
}

export interface WalletStoreSendContextualMessageArgs {
  message: string;
  toAddress: Address;
  aliasToSendTo: string; // The alias to include in the message (should be theirAlias)
  priorityFee?: PriorityFeeConfig;
}

export interface WalletStoreSendTransactionArgs {
  /**
   * payload to use for the transaction, if encryption is required, it should be encrypted before passing it here
   */
  payload?: string;
  toAddress: Address;
  password: string;
  customAmount?: bigint;
  priorityFee?: PriorityFeeConfig;
}

type WalletState = {
  wallets: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  selectedWalletId: string | null;
  unlockedWallet: UnlockedWallet | null;
  address: Address | null;
  balance: WalletBalance;
  rpc: RpcClient | null;
  isAccountServiceRunning: boolean;
  accountService: AccountService | null;
  selectedNetwork: NetworkType;
  feeEstimate: {
    estimate?: {
      lowBuckets?: Array<{ feerate: number; estimatedSeconds: number }>;
      normalBuckets?: Array<{ feerate: number; estimatedSeconds: number }>;
      priorityBucket?: { feerate: number; estimatedSeconds: number };
    };
  } | null;

  // wallet management
  loadWallets: () => void;
  selectWallet: (walletId: string) => void;
  createWallet: (
    name: string,
    mnemonic: Mnemonic,
    password: string,
    passphrase?: string
  ) => Promise<string>;
  deleteWallet: (walletId: string) => void;
  unlock: (walletId: string, password: string) => Promise<UnlockedWallet>;
  lock: () => void;

  // note: this shouldn't be wallet responsability
  // fee estimate management
  fetchFeeEstimates: () => Promise<void>;
  startFeeEstimatePolling: () => void;
  stopFeeEstimatePolling: () => void;

  // password management
  changePassword: (
    walletId: string,
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;

  // wallet name management
  changeWalletName: (walletId: string, newName: string) => void;

  // wallet operations
  stop: () => void;

  sendTransaction: (
    args: WalletStoreSendTransactionArgs
  ) => Promise<TransactionId>;

  sendMessageWithContext: (
    args: WalletStoreSendContextualMessageArgs
  ) => Promise<TransactionId>;
  sendBroadcastWithContext: (args: {
    message: string;
    channelName: string;
    priorityFee?: PriorityFeeConfig;
  }) => Promise<TransactionId>;
  getMatureUtxos: () => UtxoEntryReference[];

  estimateSendMessageFees: (
    message: string,
    toAddress: Address,
    priorityFee?: PriorityFeeConfig
  ) => Promise<GeneratorSummary>;

  estimateSendBroadcastFees: (
    message: string,
    toAddress: Address,
    channelName: string,
    priorityFee?: PriorityFeeConfig
  ) => Promise<GeneratorSummary>;

  // Actions
  setSelectedNetwork: (network: NetworkType) => void;
  setRpc: (client: RpcClient | null) => void;
};

let _accountService: AccountService | null = null;
let _feeEstimateInterval: NodeJS.Timeout | null = null;

export const useWalletStore = create<WalletState>((set, get) => {
  const _walletStorage = new WalletStorageService();

  return {
    wallets: [],
    selectedWalletId: null,
    unlockedWallet: null,
    address: null,
    balance: null,
    rpc: null,
    isAccountServiceRunning: false,
    accountService: null,
    selectedNetwork: import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet",
    feeEstimate: null,

    loadWallets: () => {
      const wallets = _walletStorage.getWalletList();
      set({ wallets });
    },

    selectWallet: (walletId: string) => {
      set({ selectedWalletId: walletId });
    },

    createWallet: async (
      name: string,
      mnemonic: Mnemonic,
      password: string,
      passphrase?: string
    ) => {
      const walletId = _walletStorage.create(
        name,
        mnemonic,
        password,
        passphrase
      );
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

    fetchFeeEstimates: async () => {
      const state = get();
      if (!state.rpc) return;

      try {
        // For testing network congestion, uncomment this mock data
        // and comment out the real RPC call below
        /*
        const mockCongestion = {
          estimate: {
            priorityBucket: {
              feerate: 3, // 3x base rate
              estimatedSeconds: 0.005,
            },
            normalBuckets: [
              {
                feerate: 2, // 2x base rate
                estimatedSeconds: 0.01,
              },
            ],
            lowBuckets: [
              {
                feerate: 1, // Base rate
                estimatedSeconds: 0.02,
              },
            ],
          },
        };
        set({ feeEstimate: mockCongestion });
        return;
        */
        const result = await state.rpc.getFeeEstimate();
        set({ feeEstimate: result });
      } catch (err) {
        console.error("Failed to fetch fee estimates:", err);
      }
    },

    startFeeEstimatePolling: () => {
      // Clear any existing interval
      if (_feeEstimateInterval) {
        clearInterval(_feeEstimateInterval);
      }

      // Initial fetch
      get().fetchFeeEstimates();

      // Set up polling
      _feeEstimateInterval = setInterval(() => {
        get().fetchFeeEstimates();
      }, FEE_ESTIMATE_POLLING_INTERVAL_IN_MS);
    },

    stopFeeEstimatePolling: () => {
      if (_feeEstimateInterval) {
        clearInterval(_feeEstimateInterval);
        _feeEstimateInterval = null;
      }
    },

    unlock: async (walletId: string, password: string) => {
      const wallet = _walletStorage.getDecrypted(walletId, password);

      const currentRpc = get().rpc;
      if (!currentRpc) {
        throw new Error("RPC client not initialized");
      }

      set({
        unlockedWallet: wallet,
        address: wallet.receivePublicKey.toAddress(
          currentRpc.networkId ?? new NetworkId("mainnet")
        ),
      });

      if (_accountService) {
        await _accountService.clear();
        _accountService.removeAllListeners();
      }

      _accountService = new AccountService(currentRpc, wallet);
      _accountService.setPassword(password);
      // Set up event listeners
      _accountService.on("balance", (balance) => {
        set({ balance });
      });
      await _accountService.start();

      const initialBalance = _accountService.context.balance;
      if (initialBalance) {
        const matureUtxos = _accountService.context.getMatureRange(
          0,
          _accountService.context.matureLength
        );
        const pendingUtxos = _accountService.context.getPending();

        set({
          balance: {
            mature: initialBalance.mature,
            pending: initialBalance.pending,
            outgoing: initialBalance.outgoing,
            matureDisplay: sompiToKaspaString(initialBalance.mature),
            pendingDisplay: sompiToKaspaString(initialBalance.pending),
            outgoingDisplay: sompiToKaspaString(initialBalance.outgoing),
            matureUtxoCount: matureUtxos.length,
            pendingUtxoCount: pendingUtxos.length,
          },
        });
      }

      set({
        rpc: currentRpc,
        isAccountServiceRunning: true,
        accountService: _accountService,
      });

      // Start fee polling when wallet starts
      get().startFeeEstimatePolling();

      return wallet;
    },

    lock: () => {
      if (_accountService) {
        _accountService.clear();
        _accountService = null;
      }
      set({
        unlockedWallet: null,
        address: null,
        balance: null,
        isAccountServiceRunning: false,
        accountService: null,
      });
    },
    stop: () => {
      if (_accountService) {
        _accountService.clear();
        _accountService = null;
      }

      // Stop fee polling when wallet stops
      get().stopFeeEstimatePolling();

      set({
        rpc: null,
        address: null,
        isAccountServiceRunning: false,
      });
    },

    estimateSendMessageFees: async (
      message: string,
      toAddress: Address,
      priorityFee?: PriorityFeeConfig
    ) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      return state.accountService.estimateSendMessageFees({
        message,
        toAddress,
        priorityFee,
      });
    },
    estimateSendBroadcastFees: async (
      message: string,
      toAddress: Address,
      channelName: string,
      priorityFee?: PriorityFeeConfig
    ) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      return state.accountService.estimateSendBroadcastFees({
        message,
        toAddress,
        priorityFee,
        channelName,
      });
    },
    sendTransaction: async (args) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }
      return state.accountService.createTransaction({
        address: args.toAddress,
        payload: args.payload ?? "",
        amount: args.customAmount ?? BigInt(0),
        priorityFee: args.priorityFee,
      });
    },
    sendMessageWithContext: async ({
      message,
      toAddress,
      priorityFee,
      aliasToSendTo,
    }) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      try {
        console.log("[wallet.store] Sending message:", {
          toAddress: toAddress.toString(),
          aliasToSendTo,
          note: "This alias will be included in the published message protocol string",
        });

        const encryptedMessage = encrypt_message(toAddress.toString(), message);

        return await state.accountService.sendMessageWithContext({
          message: encryptedMessage.to_hex(),
          toAddress,
          theirAlias: aliasToSendTo,
          priorityFee,
        });
      } catch (error) {
        console.error("Error sending contextual message:", error);
        throw error;
      }
    },
    sendBroadcastWithContext: async ({ message, channelName, priorityFee }) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      try {
        console.log("Sending broadcast message to channel:", channelName);

        // Retry logic for UTXO conflicts (moved from useBroadcastComposer)
        let txId: string;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            txId = await state.accountService.createBroadcastTransaction({
              channelName: channelName.toLowerCase(),
              message,
              priorityFee,
            });
            break; // Success, exit retry loop
          } catch (error) {
            attempts++;
            console.log(`Broadcast attempt ${attempts} failed:`, error);

            if (attempts >= maxAttempts) {
              throw error;
            }

            // Check if it's a UTXO/funds issue that might resolve
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (
              errorMessage.includes("Insufficient funds") ||
              errorMessage.includes("UTXO") ||
              errorMessage.includes("balance")
            ) {
              // Wait a bit and retry
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * attempts)
              );
            } else {
              throw error; // Non-retryable error
            }
          }
        }

        return txId!;
      } catch (error) {
        console.error("Error sending broadcast message:", error);
        throw error;
      }
    },
    getMatureUtxos: () => {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.getMatureUtxos();
    },
    setSelectedNetwork: (network: NetworkType) =>
      set({ selectedNetwork: network }),

    setRpc: (client: RpcClient | null) => {
      if (!client) {
        // If clearing the client, stop the service first
        if (_accountService) {
          _accountService.clear();
          _accountService = null;
        }
        set({ rpc: null, isAccountServiceRunning: false });
      } else {
        // Update the RPC client
        set({ rpc: client });
      }
    },

    changePassword: async (
      walletId: string,
      currentPassword: string,
      newPassword: string
    ) => {
      await _walletStorage.changePassword(
        walletId,
        currentPassword,
        newPassword
      );

      const wallet = _walletStorage.getDecrypted(walletId, newPassword);

      // If this is the currently unlocked wallet, update its password
      const state = get();
      if (state.unlockedWallet && state.selectedWalletId === walletId) {
        set({
          unlockedWallet: wallet,
        });

        const _rpc = get().rpc;
        if (_accountService && _rpc) {
          await _accountService.clear();
          _accountService.removeAllListeners();
          _accountService = new AccountService(_rpc, state.unlockedWallet);
          _accountService.setPassword(state.unlockedWallet.password);
          // Set up event listeners
          _accountService.on("balance", (balance) => {
            set({ balance });
          });
          await _accountService.start();

          set({
            accountService: _accountService,
          });
        }
      }
    },

    changeWalletName: (walletId: string, newName: string) => {
      _walletStorage.changeWalletName(walletId, newName);

      // Reload wallet list to reflect the name change
      get().loadWallets();

      // If this is the currently unlocked wallet, update its name
      const state = get();
      if (state.unlockedWallet && state.selectedWalletId === walletId) {
        set({
          unlockedWallet: {
            ...state.unlockedWallet,
            name: newName,
          },
        });
      }
    },
  };
});
