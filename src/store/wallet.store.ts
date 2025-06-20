import { create } from "zustand";
import { KaspaClient } from "../utils/all-in-one";
import { WalletStorage } from "../utils/wallet-storage";
import {
  Address,
  GeneratorSummary,
  Mnemonic,
  sompiToKaspaString,
  UtxoEntryReference,
} from "kaspa-wasm";
import { AccountService } from "../service/account-service";
import { encrypt_message } from "cipher";
import { useMessagingStore } from "./messaging.store";
import { NetworkType } from "../types/all";
import {
  WalletDerivationType,
  UnlockedWallet,
  WalletBalance,
} from "../types/wallet.type";
import { TransactionId } from "../types/transactions";

type WalletState = {
  wallets: {
    id: string;
    name: string;
    createdAt: string;
    derivationType?: WalletDerivationType;
  }[];
  selectedWalletId: string | null;
  unlockedWallet: UnlockedWallet | null;
  address: Address | null;
  balance: WalletBalance;
  rpcClient: KaspaClient | null;
  isAccountServiceRunning: boolean;
  accountService: AccountService | null;
  selectedNetwork: NetworkType;

  // wallet management
  loadWallets: () => void;
  selectWallet: (walletId: string) => void;
  createWallet: (
    name: string,
    mnemonic: Mnemonic,
    password: string,
    derivationType?: WalletDerivationType
  ) => Promise<string>;
  deleteWallet: (walletId: string) => void;
  unlock: (
    walletId: string,
    password: string
  ) => Promise<UnlockedWallet | null>;
  lock: () => void;

  // migration functionality
  migrateLegacyWallet: (
    walletId: string,
    password: string,
    newName?: string
  ) => Promise<string>;

  // wallet operations
  start: (client: KaspaClient) => Promise<{ receiveAddress: Address }>;
  stop: () => void;
  sendMessage: (
    message: string,
    toAddress: Address,
    password: string,
    customAmount?: bigint
  ) => Promise<TransactionId>;
  sendPreEncryptedMessage: (
    preEncryptedHex: string,
    toAddress: Address,
    password: string
  ) => Promise<TransactionId>;
  getMatureUtxos: () => UtxoEntryReference[];

  estimateSendMessageFees: (
    message: string,
    toAddress: Address
  ) => Promise<GeneratorSummary>;

  // Actions
  setSelectedNetwork: (network: NetworkType) => void;
  setRpcClient: (client: KaspaClient | null) => void;
};

let _accountService: AccountService | null = null;

export const useWalletStore = create<WalletState>((set, get) => {
  const _walletStorage = new WalletStorage();

  return {
    wallets: [],
    selectedWalletId: null,
    unlockedWallet: null,
    address: null,
    balance: null,
    rpcClient: null,
    isAccountServiceRunning: false,
    accountService: null,
    selectedNetwork: "mainnet",

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
      derivationType?: WalletDerivationType
    ) => {
      const walletId = _walletStorage.create(
        name,
        mnemonic,
        password,
        derivationType
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

    unlock: async (walletId: string, password: string) => {
      try {
        const wallet = await _walletStorage.getDecrypted(walletId, password);
        const currentRpcClient = get().rpcClient;
        if (!currentRpcClient) {
          throw new Error("RPC client not initialized");
        }
        wallet.client = currentRpcClient;
        set({ unlockedWallet: wallet });

        _accountService = new AccountService(currentRpcClient, wallet);
        _accountService.setPassword(password);

        // Connect the account service to the messaging store
        const messagingStore = useMessagingStore.getState();
        messagingStore.connectAccountService(_accountService);

        // Set up event listeners
        _accountService.on("balance", (balance) => {
          set({ balance });
        });

        _accountService.on("utxosChanged", async () => {
          // Balance updates handled by balance event
        });

        _accountService.on("transactionReceived", async (txDetails) => {
          if (txDetails.payload?.startsWith("636970685f6d73673a")) {
            const messageOutput = txDetails.outputs.find(
              (output: { amount: number }) => output.amount === 10000000
            );
            const recipientAddress =
              messageOutput?.script_public_key_address || "Unknown";

            let senderAddress = "Unknown";
            if (txDetails.outputs && txDetails.outputs.length > 1) {
              const changeOutput = txDetails.outputs.find(
                (output: {
                  amount: number;
                  script_public_key_address: string;
                }) =>
                  output.script_public_key_address !== recipientAddress &&
                  output.amount !== 10000000
              );
              if (changeOutput) {
                senderAddress = changeOutput.script_public_key_address;
              }
            }

            const myAddress = _accountService?.receiveAddress?.toString() || "";

            if (senderAddress === myAddress) {
              return;
            }

            const messageData = {
              transactionId: txDetails.transaction_id,
              senderAddress: senderAddress,
              recipientAddress: recipientAddress,
              timestamp: txDetails.block_time,
              payload: txDetails.payload,
              amount: messageOutput?.amount || 0,
              content: "[New message - click refresh to decrypt]",
            };

            if (myAddress) {
              messagingStore.storeMessage(messageData, myAddress);
              messagingStore.loadMessages(myAddress);

              if (
                messagingStore.openedRecipient ===
                (senderAddress === myAddress ? recipientAddress : senderAddress)
              ) {
                messagingStore.refreshMessagesOnOpenedRecipient();
              }
            }
          }
        });

        await _accountService.start();

        const initialBalance = await _accountService.context.balance;
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
          rpcClient: currentRpcClient,
          address: _accountService.receiveAddress,
          isAccountServiceRunning: true,
          accountService: _accountService,
        });

        return wallet;
      } catch (error) {
        console.error("Failed to unlock wallet:", error);
        throw error;
      }
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
        isAccountServiceRunning: false,
        accountService: null,
      });
    },

    start: async (client: KaspaClient) => {
      const { unlockedWallet } = get();
      if (!unlockedWallet) {
        throw new Error("Wallet not unlocked");
      }

      _accountService = new AccountService(client, unlockedWallet);
      _accountService.setPassword(unlockedWallet.password);

      _accountService.on("balance", (balance) => {
        set({ balance });
      });

      _accountService.on("utxosChanged", async () => {
        // Balance updates handled by balance event
      });

      _accountService.on("transactionReceived", async (txDetails) => {
        if (txDetails.payload?.startsWith("636970685f6d73673a")) {
          const messageOutput = txDetails.outputs.find(
            (output: { amount: number }) => output.amount === 10000000
          );
          const recipientAddress =
            messageOutput?.script_public_key_address || "Unknown";

          let senderAddress = "Unknown";
          if (txDetails.outputs && txDetails.outputs.length > 1) {
            const changeOutput = txDetails.outputs.find(
              (output: { amount: number; script_public_key_address: string }) =>
                output.script_public_key_address !== recipientAddress &&
                output.amount !== 10000000
            );
            if (changeOutput) {
              senderAddress = changeOutput.script_public_key_address;
            }
          }

          const myAddress = _accountService?.receiveAddress?.toString() || "";

          if (senderAddress === myAddress) {
            return;
          }

          const messageData = {
            transactionId: txDetails.transaction_id,
            senderAddress: senderAddress,
            recipientAddress: recipientAddress,
            timestamp: txDetails.block_time,
            payload: txDetails.payload,
            amount: messageOutput?.amount || 0,
            content: "[New message - click refresh to decrypt]",
          };

          const messagingStore = useMessagingStore.getState();
          if (myAddress) {
            messagingStore.storeMessage(messageData, myAddress);
            messagingStore.loadMessages(myAddress);

            if (
              messagingStore.openedRecipient ===
              (senderAddress === myAddress ? recipientAddress : senderAddress)
            ) {
              messagingStore.refreshMessagesOnOpenedRecipient();
            }
          }
        }
      });

      await _accountService.start();

      const initialBalance = await _accountService.context.balance;
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
            outgoingDisplay: sompiToKaspaString(initialBalance.outgoing),
            pendingDisplay: sompiToKaspaString(initialBalance.pending),
            matureUtxoCount: matureUtxos.length,
            pendingUtxoCount: pendingUtxos.length,
          },
        });
      }

      set({
        rpcClient: client,
        address: _accountService.receiveAddress,
        isAccountServiceRunning: true,
        accountService: _accountService,
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

    estimateSendMessageFees: async (message: string, toAddress: Address) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      return state.accountService.estimateSendMessageFees({
        message,
        toAddress,
      });
    },

    sendMessage: async (
      message: string,
      toAddress: Address,
      password: string,
      customAmount?: bigint
    ) => {
      const state = get();
      if (!state.unlockedWallet || !state.accountService) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      try {
        // Check if this is a handshake message
        if (
          message.startsWith("ciph_msg:") &&
          message.includes(":handshake:")
        ) {
          // Always send handshake messages to the recipient's address
          console.log("Sending handshake message to:", toAddress.toString());
          const encryptedMessage = await encrypt_message(
            toAddress.toString(),
            message
          );
          if (!encryptedMessage) {
            throw new Error("Failed to encrypt handshake message");
          }
          return await state.accountService.sendMessage({
            message: encryptedMessage.to_hex(),
            toAddress,
            password,
            amount: customAmount,
          });
        }

        // For regular messages, send to recipient
        console.log(
          "Sending regular message to recipient:",
          toAddress.toString()
        );
        const encryptedMessage = await encrypt_message(
          toAddress.toString(),
          message
        );
        if (!encryptedMessage) {
          throw new Error("Failed to encrypt message");
        }
        return await state.accountService.sendMessage({
          message: encryptedMessage.to_hex(),
          toAddress,
          password,
          amount: customAmount,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      }
    },

    sendPreEncryptedMessage: (preEncryptedHex, toAddress, password) => {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.sendPreEncryptedMessage(
        toAddress,
        preEncryptedHex,
        password
      );
    },

    getMatureUtxos: () => {
      if (!_accountService) {
        throw Error("Account service not initialized.");
      }
      return _accountService.getMatureUtxos();
    },

    setSelectedNetwork: (network: NetworkType) =>
      set({ selectedNetwork: network }),

    setRpcClient: (client: KaspaClient | null) => {
      if (!client) {
        // If clearing the client, stop the service first
        if (_accountService) {
          _accountService.stop();
          _accountService = null;
        }
        set({ rpcClient: null, isAccountServiceRunning: false });
      } else {
        // Update the RPC client
        set({ rpcClient: client });
      }
    },

    migrateLegacyWallet: async (
      walletId: string,
      password: string,
      newName?: string
    ) => {
      const newWalletId = await _walletStorage.migrateLegacyWallet(
        walletId,
        password,
        newName
      );
      get().loadWallets();
      return newWalletId;
    },
  };
});
