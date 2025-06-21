import {
  Address,
  Generator,
  kaspaToSompi,
  PaymentOutput,
  PendingTransaction,
  UtxoContext,
  UtxoProcessor,
  UtxoEntry,
  IUtxosChanged,
  ITransaction,
  sompiToKaspaString,
  FeeSource,
  GeneratorSummary,
} from "kaspa-wasm";
import { KaspaClient } from "../utils/all-in-one";
import { WalletStorage } from "../utils/wallet-storage";
import EventEmitter from "eventemitter3";
import { encrypt_message } from "cipher";
import { CipherHelper } from "../utils/cipher-helper";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { UnlockedWallet } from "src/types/wallet.type";
import { TransactionId } from "src/types/transactions";

// Message related types
type DecodedMessage = {
  transactionId: string;
  senderAddress: string;
  recipientAddress: string;
  timestamp: number;
  content: string;
  amount: number;
  payload: string;
  fileData?: {
    type: string;
    name: string;
    size: number;
    mimeType: string;
    content: string;
  };
};

// strictly typed events
type AccountServiceEvents = {
  balance: (balance: {
    mature: bigint;
    pending: bigint;
    outgoing: bigint;
    matureDisplay: string;
    pendingDisplay: string;
    outgoingDisplay: string;
    matureUtxoCount: number;
    pendingUtxoCount: number;
  }) => void;
  utxosChanged: (utxos: UtxoEntry[]) => void;
  transactionReceived: (transaction: any) => void;
  messageReceived: (message: DecodedMessage) => void;
};

type SendMessageArgs = {
  toAddress: Address;
  message: string;
  password: string;
  amount?: bigint; // Optional custom amount, defaults to 0.2 KAS
};

type EstimateSendMessageFeesArgs = {
  toAddress: Address;
  message: string;
};

type SendMessageWithContextArgs = {
  toAddress: Address;
  message: string;
  password: string;
  theirAlias: string;
};

type CreateTransactionArgs = {
  address: Address;
  amount: bigint;
  payload: string;
  payloadSize?: number;
  messageLength?: number;
};

type CreateWithdrawTransactionArgs = {
  address: Address;
  amount: bigint;
};

// Add this helper function at the top level
function stringifyWithBigInt(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

interface Conversation {
  conversationId: string;
  myAlias: string;
  theirAlias: string;
  kaspaAddress: string;
  status: string;
  createdAt: number;
  lastActivity: number;
  initiatedByMe: boolean;
}

export class AccountService extends EventEmitter<AccountServiceEvents> {
  processor: UtxoProcessor;
  context: UtxoContext;
  networkId: string;

  // only populated when started
  isStarted: boolean = false;
  receiveAddress: Address | null = null;

  private processedMessageIds: Set<string> = new Set();
  private monitoredConversations: Set<string> = new Set(); // Store monitored aliases
  private monitoredAddresses: Map<string, string> = new Map(); // Store address -> alias mappings
  private readonly MESSAGE_PREFIX_HEX = "636970685f6d73673a"; // "ciph_msg:" in hex
  private readonly MAX_PROCESSED_MESSAGES = 1000; // Prevent unlimited growth

  // Add password field
  private password: string | null = null;

  private conversations: Conversation[] = [];
  private conversationsLoaded = false;

  constructor(
    private readonly rpcClient: KaspaClient,
    private readonly unlockedWallet: UnlockedWallet
  ) {
    super();

    if (!rpcClient.rpc) {
      throw new Error("RPC client is not initialized");
    }

    this.networkId = rpcClient.networkId;

    this.processor = new UtxoProcessor({
      networkId: this.networkId,
      rpc: rpcClient.rpc,
    });
    this.context = new UtxoContext({ processor: this.processor });

    // Set password from unlocked wallet if available
    if (unlockedWallet.password) {
      this.password = unlockedWallet.password;
    }
  }

  // Add method to set password
  public setPassword(password: string) {
    if (!password) {
      throw new Error("Password cannot be empty");
    }
    console.log("Setting password in AccountService");
    this.password = password;
  }

  // Add method to check if password is set
  private ensurePasswordSet() {
    if (!this.password) {
      throw new Error("Password not set - cannot perform operation");
    }
  }

  private _emitBalanceUpdate() {
    const balance = this.context.balance;
    if (!balance) return;

    // Get UTXOs for counting
    const matureUtxos = this.context.getMatureRange(
      0,
      this.context.matureLength
    );
    const pendingUtxos = this.context.getPending();

    console.log("Balance update:", {
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length,
      mature: balance.mature.toString(),
      pending: balance.pending.toString(),
      outgoing: balance.outgoing.toString(),
    });

    this.emit("balance", {
      mature: balance.mature,
      pending: balance.pending,
      outgoing: balance.outgoing,
      matureDisplay: sompiToKaspaString(balance.mature),
      pendingDisplay: sompiToKaspaString(balance.pending),
      outgoingDisplay: sompiToKaspaString(balance.outgoing),
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length,
    });
  }

  private async _fetchTransactionDetails(txId: string) {
    const maxRetries = 10; // Increased to 10 attempts
    const retryDelay = 2000; // Changed to 2 seconds between retries

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const baseUrl =
          this.networkId === "mainnet"
            ? "https://api.kaspa.org"
            : "https://api-tn10.kaspa.org";
        const response = await fetch(
          `${baseUrl}/transactions/${txId}?inputs=true&outputs=true&resolve_previous_outpoints=no`
        );

        if (response.status === 404) {
          console.log(
            `Transaction ${txId} not yet available in API (attempt ${
              attempt + 1
            }/${maxRetries}), retrying in 2 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch transaction details: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log(
          `Successfully fetched transaction details for ${txId} on attempt ${
            attempt + 1
          }`
        );
        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(
            `Error fetching transaction details for ${txId} after ${maxRetries} attempts:`,
            error
          );
          return null;
        }
        console.log(
          `Attempt ${
            attempt + 1
          }/${maxRetries} failed, retrying in 2 seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  }

  private async fetchHistoricalMessages() {
    if (!this.receiveAddress) return;

    try {
      console.log("Fetching historical messages...");
      const address = this.receiveAddress.toString();

      // Use the network-appropriate API endpoint
      const baseUrl =
        this.networkId === "mainnet"
          ? "https://api.kaspa.org"
          : "https://api-tn10.kaspa.org";
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `${baseUrl}/addresses/${encodedAddress}/full-transactions-page?limit=50&before=0&after=0&resolve_previous_outpoints=no`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch historical transactions: ${response.statusText}`
        );
      }

      const data = await response.json();
      const transactions = data.transactions || [];

      console.log(`Found ${transactions.length} historical transactions`);

      // Update monitored conversations BEFORE processing messages
      await this.updateMonitoredConversations();

      // Process each transaction
      for (const tx of transactions) {
        const txId = tx.transactionId;
        if (!txId || this.processedMessageIds.has(txId)) continue;

        // Check if this is a message transaction and involves our address
        if (this.isMessageTransaction(tx) && this.isTransactionForUs(tx)) {
          await this.processMessageTransaction(tx, txId, Number(tx.blockTime));
        }
      }

      console.log("Historical message fetch complete");
    } catch (error) {
      console.error("Error fetching historical messages:", error);
    }
  }

  async start() {
    try {
      // Get the receive address from the wallet
      const initialReceiveAddress =
        this.unlockedWallet.publicKeyGenerator.receiveAddress(
          this.networkId,
          0
        );

      // Ensure it has the proper network prefix
      this.receiveAddress = this.ensureAddressPrefix(initialReceiveAddress);

      console.log(
        "Using primary address for all operations:",
        this.receiveAddress.toString()
      );

      // Initialize UTXO processor first
      console.log("Starting UTXO processor...");
      await this.processor.start();

      // Set up event listeners before doing anything else
      console.log("Setting up event listeners...");

      // Set up balance change listener
      this.processor.addEventListener("balance", async () => {
        console.log("Balance event received");
        this._emitBalanceUpdate();
      });

      // Only track primary address
      const addressesToTrack = [this.receiveAddress!];

      // Now track addresses in UTXO processor
      console.log("Starting address tracking for primary address...");
      await this.context.trackAddresses(addressesToTrack);

      // Set up block subscription with optimized message handling
      console.log("Setting up block subscription...");
      await this.rpcClient.subscribeToBlockAdded(
        this.processBlockEvent.bind(this)
      );
      console.log("Successfully subscribed to block events");

      // Fetch historical messages after setup is complete
      await this.fetchHistoricalMessages();

      // Get initial state one more time to ensure we're up to date
      this._emitBalanceUpdate();

      this.isStarted = true;
    } catch (error) {
      console.error("Failed to start account service:", error);
      throw error;
    }
  }

  async stop() {
    console.log("Stopping UTXO subscription and processor...");
    try {
      // Stop the UTXO processor
      await this.processor.stop();

      // Clean up our local state
      this.isStarted = false;
      console.log("Successfully cleaned up UTXO subscription and processor");
    } catch (error) {
      console.error(
        "Failed to clean up UTXO subscription and processor:",
        error
      );
    }
  }

  public async createTransaction(
    transaction: CreateTransactionArgs,
    password: string
  ): Promise<TransactionId> {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!transaction.address) {
      throw new Error("Transaction address is required");
    }

    if (!transaction.amount) {
      throw new Error("Transaction amount is required");
    }

    console.log("=== CREATING TRANSACTION ===");
    const primaryAddress = this.receiveAddress;
    console.log(
      "Creating transaction from primary address:",
      primaryAddress.toString()
    );
    console.log(
      "Change will go back to primary address:",
      primaryAddress.toString()
    );
    console.log(`Destination: ${transaction.address.toString()}`);
    console.log(
      `Amount: ${Number(transaction.amount) / 100000000} KAS (${
        transaction.amount
      } sompi)`
    );
    console.log(`Payload length: ${transaction.payload.length / 2} bytes`);

    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    try {
      // Use our optimized generator creation method
      const generator = this._getGeneratorForTransaction(transaction);

      console.log("Generating transaction...");
      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();
      console.log(
        `Transaction requires signing ${addressesToSign.length} addresses:`
      );
      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        console.log("Using primary address key for signing");
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      console.log("Signing transaction...");
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      console.log("Submitting transaction to network...");
      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);
      console.log(`Transaction submitted with ID: ${txId}`);
      console.log("========================");

      return txId;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async createWithdrawTransaction(
    withdrawTransaction: CreateWithdrawTransactionArgs,
    password: string
  ) {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!withdrawTransaction.address) {
      throw new Error("Transaction address is required");
    }

    if (!withdrawTransaction.amount) {
      throw new Error("Transaction amount is required");
    }

    console.log("=== CREATING WITHDRAW TRANSACTION ===");
    const primaryAddress = this.receiveAddress;
    console.log(
      "Creating withdraw transaction from primary address:",
      primaryAddress.toString()
    );
    console.log(
      "Change will go back to primary address:",
      primaryAddress.toString()
    );
    console.log(`Destination: ${withdrawTransaction.address.toString()}`);
    console.log(
      `Amount: ${Number(withdrawTransaction.amount) / 100000000} KAS (${
        withdrawTransaction.amount
      } sompi)`
    );
    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    try {
      // Use our optimized generator creation method
      const generator =
        this._getGeneratorForWithdrawTransaction(withdrawTransaction);

      console.log("Generating transaction...");
      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();
      console.log(
        `Transaction requires signing ${addressesToSign.length} addresses:`
      );
      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        console.log("Using primary address key for signing");
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      console.log("Signing transaction...");
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      console.log("Submitting transaction to network...");

      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);

      // reset the context to workaround "withdraw all" use-case where change address isn't the user
      // @IMPROVEMENT: this could be only executed when "withdraw all", currently done even if it's partial
      await this.context.clear();
      await this.context.trackAddresses([this.receiveAddress!]);

      console.log(`Transaction submitted with ID: ${txId}`);
      console.log("========================");

      return txId;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async estimateTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this._getGeneratorForTransaction(transaction).estimate();
  }

  // Add method to load conversations
  private async loadConversations(): Promise<void> {
    try {
      // If conversations are already loaded and we have some, return
      if (this.conversationsLoaded && this.conversations.length > 0) {
        return;
      }

      // Maximum number of retries
      const maxRetries = 10;
      let retries = 0;

      while (!this.conversationsLoaded && retries < maxRetries) {
        // Wait for conversations to load
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if we have conversations
        if (this.conversations && this.conversations.length > 0) {
          this.conversationsLoaded = true;
          console.log("Conversations loaded:", this.conversations.length);
          break;
        }

        retries++;
        console.log("Waiting for conversations... attempt", retries);
      }

      // If we still don't have conversations, log a warning but continue
      if (!this.conversationsLoaded) {
        console.warn("Could not load conversations after maximum retries");
        // Set loaded to true anyway to prevent further retries
        this.conversationsLoaded = true;
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      // Set loaded to true to prevent further retries
      this.conversationsLoaded = true;
    }
  }

  public async sendMessage(
    sendMessage: SendMessageArgs
  ): Promise<TransactionId> {
    this.ensurePasswordSet();
    // Use custom amount if provided, otherwise default to 0.2 KAS
    const defaultAmount = kaspaToSompi("0.2");
    const messageAmount = sendMessage.amount || defaultAmount;

    if (!messageAmount) {
      throw new Error("Message amount missing");
    }

    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    if (!sendMessage.password) {
      throw new Error("Password is required");
    }

    const destinationAddress = this.ensureAddressPrefix(sendMessage.toAddress);
    const addressString = destinationAddress.toString();

    // Check if the message is already encrypted (hex format)
    const isPreEncrypted = /^[0-9a-fA-F]+$/.test(sendMessage.message);

    let payload;
    if (isPreEncrypted) {
      // Message is already encrypted, just add the prefix
      const prefix = "ciph_msg:"
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
      payload = prefix + sendMessage.message;
    } else {
      console.log("ENCRYPT MESSAGE", sendMessage.message);
      // Message needs to be encrypted
      const encryptedMessage = encrypt_message(
        addressString,
        sendMessage.message
      );
      if (!encryptedMessage) {
        throw new Error("Failed to encrypt message");
      }
      const prefix = "ciph_msg:"
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
      payload = prefix + encryptedMessage.to_hex();
    }

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      const txId = await this.createTransaction(
        {
          address: destinationAddress,
          amount: messageAmount,
          payload: payload,
        },
        sendMessage.password
      );

      return txId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  public async estimateSendMessageFees(
    sendMessage: EstimateSendMessageFeesArgs
  ): Promise<GeneratorSummary> {
    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    const destinationAddress = this.ensureAddressPrefix(sendMessage.toAddress);
    const addressString = destinationAddress.toString();

    // Message needs to be encrypted
    const encryptedMessage = encrypt_message(
      addressString,
      sendMessage.message
    );

    if (!encryptedMessage) {
      throw new Error("Failed to encrypt message");
    }

    const prefix = "ciph_msg";
    const version = "1";
    const messageType = "comm";
    const payload = `${prefix}:${version}:${messageType}:b4e3da89391b:${encryptedMessage.to_hex()}`;

    const payloadHex = payload
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      const summary = await this.estimateTransaction({
        address: destinationAddress,
        amount: BigInt(0.2 * 100_000_000),
        payload: payloadHex,
      });

      return summary;
    } catch (error) {
      console.error("Error estimating transaction fees:", error);
      throw error;
    }
  }

  /**
   * Helper function to handle SEC1 format compatibility
   * for pre-encrypted messages
   */
  private adjustForSEC1Format(encryptedHex: string): string {
    // Check if the key starts with 02 or 03 (compressed SEC1 format)
    const keyStart = encryptedHex.substring(24, 26);
    if (keyStart !== "02" && keyStart !== "03") {
      return encryptedHex; // Not a SEC1 key, return unchanged
    }

    console.log("Detected SEC1 compressed key format in pre-encrypted message");

    // Extract components
    const nonce = encryptedHex.substring(0, 24);
    const ephemeralPublicKey = encryptedHex.substring(24, 24 + 66);
    const ciphertext = encryptedHex.substring(24 + 66);

    // Extract the X coordinate (without the 02/03 prefix)
    const publicKeyWithoutPrefix = ephemeralPublicKey.substring(2);

    // The public key should be exactly 32 bytes (64 hex chars)
    // If it's shorter, pad it with zeros at the end
    const paddedPublicKey = publicKeyWithoutPrefix.padEnd(64, "0");

    // Create new hex with padded public key
    const modifiedHex = nonce + paddedPublicKey + ciphertext;
    console.log("Adjusted hex for SEC1 format compatibility");

    return modifiedHex;
  }

  /**
   * Send a message using a pre-encrypted hex value from the visualizer
   * Use this to test sending a message with known-good encryption
   */
  public async sendPreEncryptedMessage(
    toAddress: Address,
    preEncryptedHex: string,
    password: string
  ) {
    const minimumAmount = kaspaToSompi("0.2");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    // Ensure the destination address has the proper prefix
    const destinationAddress = this.ensureAddressPrefix(toAddress);
    console.log(
      "Sending pre-encrypted message to:",
      destinationAddress.toString()
    );
    console.log("Pre-encrypted message:", preEncryptedHex);

    // Ensure the pre-encrypted message is compatible with the Rust code
    const adjustedHex = this.adjustForSEC1Format(preEncryptedHex);

    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    // Use the provided pre-encrypted hex directly
    const payload = prefix + adjustedHex;
    console.log("Final transaction payload:", payload);

    return this.createTransaction(
      {
        address: destinationAddress,
        amount: minimumAmount,
        payload: payload,
      },
      password
    );
  }

  public getMatureUtxos() {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this.context.getMatureRange(0, this.context.matureLength);
  }

  /**
   * Helper method to ensure an address has the proper network prefix
   */
  private ensureAddressPrefix(address: Address): Address {
    const addressString = address.toString();

    // If address already has a prefix, return it unchanged
    if (addressString.includes(":")) {
      return address;
    }

    // Add appropriate prefix based on network
    let prefixedAddressString = addressString;
    if (this.networkId === "testnet-10" || this.networkId === "testnet-11") {
      prefixedAddressString = `kaspatest:${addressString}`;
    } else if (this.networkId === "mainnet") {
      prefixedAddressString = `kaspa:${addressString}`;
    } else if (this.networkId === "devnet") {
      prefixedAddressString = `kaspadev:${addressString}`;
    }

    console.log(`Added prefix to address: ${prefixedAddressString}`);
    return new Address(prefixedAddressString);
  }

  private _getGeneratorForTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    // Ensure both addresses have the correct prefixes
    const destinationAddress = this.ensureAddressPrefix(transaction.address);
    const primaryAddress = this.ensureAddressPrefix(this.receiveAddress!);

    // Log both addresses for debugging
    console.log("Using destination address:", destinationAddress.toString());
    console.log("Using primary address for change:", primaryAddress.toString());

    // Check if this is a direct self-message (sending to our own receive address)
    const isDirectSelfMessage =
      destinationAddress.toString() === this.receiveAddress?.toString();

    let isMessageTransaction = false;
    if (transaction.payload) {
      // Check if this is a message transaction by looking for the message prefix
      isMessageTransaction = transaction.payload.startsWith(
        this.MESSAGE_PREFIX_HEX
      );
    }

    // Check if we have an active conversation with this address
    const messagingStore = useMessagingStore.getState();
    const conversationManager = messagingStore?.conversationManager;
    let hasActiveConversation = false;

    if (conversationManager) {
      const conversations = conversationManager.getMonitoredConversations();
      hasActiveConversation = conversations.some(
        (conv) => conv.address === destinationAddress.toString()
      );
      console.log("Active conversation check:", {
        destinationAddress: destinationAddress.toString(),
        hasActiveConversation,
        conversations: conversations,
      });
    }

    // Only treat as self-message if it's a message transaction AND either direct self-message or has active conversation
    const isSelfMessage =
      isMessageTransaction && (isDirectSelfMessage || hasActiveConversation);
    console.log("Transaction type:", {
      isDirectSelfMessage,
      hasActiveConversation,
      isMessageTransaction,
      isSelfMessage,
    });

    // For regular transactions, always use the specified amount and destination
    // For self-messages, use empty outputs array to only use change output
    const outputs = isSelfMessage
      ? []
      : [new PaymentOutput(destinationAddress, transaction.amount)];

    return new Generator({
      changeAddress: primaryAddress, // Always use primary address for change
      entries: this.context,
      outputs: outputs,
      payload: transaction.payload,
      networkId: this.networkId,
      priorityFee: BigInt(0),
    });
  }

  private _getGeneratorForWithdrawTransaction(
    transaction: CreateWithdrawTransactionArgs
  ) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    console.log("Using destination address:", transaction.address.toString());

    const isFullBalance = transaction.amount === this.context.balance?.mature;

    const changeAddress = isFullBalance
      ? new Address(transaction.address.toString())
      : this.receiveAddress!;

    return new Generator({
      changeAddress,
      entries: this.context,
      // priorityEntries: this.context.getMatureRange(0, this.context.matureLength),
      outputs: [new PaymentOutput(transaction.address, transaction.amount)],
      networkId: this.networkId,
      priorityFee: {
        amount: BigInt(0),
        source: FeeSource.ReceiverPays,
      },
    });
  }

  private isMessageTransaction(tx: ITransaction): boolean {
    return tx?.payload?.startsWith(this.MESSAGE_PREFIX_HEX) ?? false;
  }

  private async processMessageTransaction(
    tx: any,
    blockHash: string,
    blockTime: number
  ) {
    try {
      // Get sender address from transaction inputs
      let senderAddress = null;
      if (tx.inputs && tx.inputs.length > 0) {
        const input = tx.inputs[0];
        const prevTxId = input.previousOutpoint?.transactionId;
        const prevOutputIndex = input.previousOutpoint?.index;

        if (prevTxId && typeof prevOutputIndex === "number") {
          try {
            const prevTx = await this._fetchTransactionDetails(prevTxId);
            if (prevTx?.outputs && prevTx.outputs[prevOutputIndex]) {
              const output = prevTx.outputs[prevOutputIndex];
              senderAddress = output.verboseData?.scriptPublicKeyAddress;
            }
          } catch (error) {
            console.error("Error getting sender address:", error);
          }
        }
      }

      // If we still don't have a sender address, use the change output address
      if (!senderAddress && tx.outputs && tx.outputs.length > 1) {
        senderAddress = tx.outputs[1].verboseData?.scriptPublicKeyAddress;
      }

      // Get the recipient address from the outputs
      let recipientAddress = null;
      if (tx.outputs && tx.outputs.length > 0) {
        recipientAddress = tx.outputs[0].verboseData?.scriptPublicKeyAddress;
      }

      // Process the message
      if (!tx.payload.startsWith(this.MESSAGE_PREFIX_HEX)) {
        return;
      }

      try {
        this.ensurePasswordSet();
      } catch (error) {
        return;
      }

      const messageHex = tx.payload.substring(this.MESSAGE_PREFIX_HEX.length);
      const handshakePrefix = "313a68616e647368616b653a";
      const commPrefix = "313a636f6d6d3a";

      let messageType = "unknown";
      let isHandshake = false;
      let targetAlias = null;
      let encryptedHex = messageHex;

      if (messageHex.startsWith(handshakePrefix)) {
        messageType = "handshake";
        isHandshake = true;
        encryptedHex = messageHex;
      } else if (messageHex.startsWith(commPrefix)) {
        const hexToString = (hex: string) => {
          let str = "";
          for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          return str;
        };

        const messageStr = hexToString(messageHex);
        const parts = messageStr.split(":");

        if (parts.length >= 4) {
          messageType = "comm";
          targetAlias = parts[2];
          encryptedHex = parts[3];
        }
      }

      const isMonitoredAddress =
        (senderAddress && this.monitoredAddresses.has(senderAddress)) ||
        (recipientAddress && this.monitoredAddresses.has(recipientAddress));
      const isCommForUs =
        messageType === "comm" &&
        targetAlias &&
        this.monitoredConversations.has(targetAlias);

      try {
        const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
          this.unlockedWallet,
          this.password!
        );

        let decryptedContent = "";
        let decryptionSuccess = false;

        try {
          const privateKey = privateKeyGenerator.receiveKey(0);
          const txId = tx.verboseData?.transactionId;
          if (!txId) {
            throw new Error("Transaction ID is missing");
          }
          const result = await CipherHelper.tryDecrypt(
            encryptedHex,
            privateKey.toString(),
            txId
          );
          decryptedContent = result;
          decryptionSuccess = true;

          if (decryptedContent.includes('"type":"handshake"')) {
            messageType = "handshake";
            isHandshake = true;
            try {
              const handshakeData = JSON.parse(decryptedContent);
              if (handshakeData.isResponse) {
                await this.updateMonitoredConversations();
              }
            } catch (error) {
              console.error("Error parsing handshake data:", error);
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.debug(`Failed to decrypt with receive key:`, error);
          }
        }

        if (!decryptionSuccess) {
          try {
            const privateKey = privateKeyGenerator.changeKey(0);
            const txId = tx.verboseData?.transactionId;
            if (!txId) {
              throw new Error("Transaction ID is missing");
            }
            const result = await CipherHelper.tryDecrypt(
              encryptedHex,
              privateKey.toString(),
              txId
            );
            decryptedContent = result;
            decryptionSuccess = true;

            if (decryptedContent.includes('"type":"handshake"')) {
              messageType = "handshake";
              isHandshake = true;
              try {
                const handshakeData = JSON.parse(decryptedContent);
                if (handshakeData.isResponse) {
                  await this.updateMonitoredConversations();
                }
              } catch (error) {
                console.error("Error parsing handshake data:", error);
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.debug(`Failed to decrypt with change key:`, error);
            }
          }
        }

        if (
          decryptionSuccess &&
          (isHandshake || isMonitoredAddress || isCommForUs)
        ) {
          const txId = tx.verboseData?.transactionId;
          if (!txId) {
            throw new Error("Transaction ID is missing");
          }
          const message: DecodedMessage = {
            transactionId: txId,
            senderAddress: senderAddress || "Unknown",
            recipientAddress: recipientAddress || "Unknown",
            timestamp: blockTime,
            content: decryptedContent,
            amount: Number(tx.outputs[0].value) / 100000000,
            payload: tx.payload,
          };

          this.processedMessageIds.add(txId);
          if (this.processedMessageIds.size > this.MAX_PROCESSED_MESSAGES) {
            const oldestId = this.processedMessageIds.values().next().value;

            if (oldestId) {
              this.processedMessageIds.delete(oldestId);
            }
          }

          if (this.receiveAddress) {
            const messagingStore = useMessagingStore.getState();
            if (messagingStore) {
              const myAddress = this.receiveAddress.toString();
              messagingStore.storeMessage(message, myAddress);
              messagingStore.loadMessages(myAddress);
            }
          }

          if (isHandshake) {
            await this.updateMonitoredConversations();
          }

          this.emit("messageReceived", message);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    } catch (error) {
      console.error(
        `Error processing message transaction ${tx.verboseData?.transactionId}:`,
        error
      );
    }
  }

  private isTransactionForUs(tx: ITransaction): boolean {
    if (!this.receiveAddress) return false;
    const ourAddress = this.receiveAddress.toString();

    // Helper function to extract address from output
    const getOutputAddress = (output: any): string | null => {
      if (output?.scriptPublicKey?.verboseData?.scriptPublicKeyAddress) {
        return output.scriptPublicKey.verboseData.scriptPublicKeyAddress;
      }
      if (output?.verboseData?.scriptPublicKeyAddress) {
        return output.verboseData.scriptPublicKeyAddress;
      }
      if (output?.scriptPublicKeyAddress) {
        return output.scriptPublicKeyAddress;
      }
      return null;
    };

    // Check if this is a message transaction
    const isMessageTx = this.isMessageTransaction(tx);
    if (!isMessageTx) return false;

    // For message transactions, check both outputs
    const messageAmount = BigInt(20000000); // 0.2 KAS

    // Find message output and change output
    let messageOutput = null;
    let changeOutput = null;

    if (tx.outputs) {
      for (const output of tx.outputs) {
        const value =
          typeof output.value === "bigint"
            ? output.value
            : BigInt(output.value || 0);
        const address = getOutputAddress(output);

        if (value === messageAmount) {
          messageOutput = output;
        } else {
          changeOutput = output;
        }
      }
    }

    // Get addresses from outputs
    const messageAddress = messageOutput
      ? getOutputAddress(messageOutput)
      : null;
    const changeAddress = changeOutput ? getOutputAddress(changeOutput) : null;

    // We're involved if we're either the recipient (message output)
    // or the sender (change output)
    return messageAddress === ourAddress || changeAddress === ourAddress;
  }

  private stringifyWithBigInt(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
  }

  public async sendMessageWithContext(sendMessage: SendMessageWithContextArgs) {
    this.ensurePasswordSet();

    // Ensure we have our receive address
    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    const minimumAmount = kaspaToSompi("0.2");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    if (!sendMessage.password) {
      throw new Error("Password is required");
    }

    if (!sendMessage.theirAlias) {
      throw new Error("Conversation alias is required");
    }

    // Get the conversation manager from the messaging store
    const messagingStore = useMessagingStore.getState();
    const conversationManager = messagingStore.conversationManager;
    if (!conversationManager) {
      throw new Error("Conversation manager not initialized");
    }

    // For self-messages, we still want to encrypt using the conversation partner's address
    const conversation = conversationManager.getConversationByAlias(
      sendMessage.theirAlias
    );
    if (!conversation) {
      throw new Error("Could not find conversation for the given alias");
    }

    console.log("Encryption details:", {
      conversationPartnerAddress: conversation.kaspaAddress,
      ourAddress: this.receiveAddress?.toString(),
      theirAlias: sendMessage.theirAlias,
      destinationAddress: this.receiveAddress?.toString(),
      conversation: conversation,
    });

    // Use the conversation partner's address for encryption, even though we're sending to ourselves
    const encryptedMessage = encrypt_message(
      conversation.kaspaAddress,
      sendMessage.message
    );
    if (!encryptedMessage) {
      throw new Error("Failed to encrypt message");
    }

    // Create the payload with conversation context
    const prefix = "ciph_msg";
    const version = "1"; // Use the current protocol version
    const messageType = "comm"; // Use comm type for conversation messages
    const payload = `${prefix}:${version}:${messageType}:${
      sendMessage.theirAlias
    }:${encryptedMessage.to_hex()}`;

    // Convert the payload to hex
    const payloadHex = payload
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    try {
      // Always send to our own address for self-send messages
      const destinationAddress = new Address(this.receiveAddress.toString());

      // Send to our own address
      const txId = await this.createTransaction(
        {
          address: destinationAddress,
          amount: minimumAmount,
          payload: payloadHex,
        },
        sendMessage.password
      );

      return txId;
    } catch (error) {
      console.error("Error sending message with context:", error);
      throw error;
    }
  }

  private async updateMonitoredConversations() {
    try {
      const { useMessagingStore } = await import("../store/messaging.store");
      const messagingStore = useMessagingStore.getState();
      const conversationManager = messagingStore?.conversationManager;

      if (!conversationManager) return;

      // Update our monitored conversations
      this.monitoredConversations.clear();
      this.monitoredAddresses.clear();
      const conversations = conversationManager.getMonitoredConversations();

      // Silently update monitored conversations
      conversations.forEach((conv: { alias: string; address: string }) => {
        this.monitoredConversations.add(conv.alias);
        this.monitoredAddresses.set(conv.address, conv.alias);
      });
    } catch (error) {
      console.error("Error updating monitored conversations:", error);
    }
  }

  private async processBlockEvent(event: any) {
    try {
      const blockTime =
        Number(event?.data?.block?.header?.timestamp) || Date.now();
      const blockHash = event?.data?.block?.header?.hash;
      const transactions = event?.data?.block?.transactions || [];

      // Process transactions silently
      const txOutputsMap = new Map<string, any[]>();
      transactions.forEach((tx: any) => {
        if (tx.outputs && tx.verboseData?.transactionId) {
          txOutputsMap.set(tx.verboseData.transactionId, tx.outputs);
        }
      });

      await this.updateMonitoredConversations();

      for (const tx of transactions) {
        const txId = tx.verboseData?.transactionId;
        if (!txId || this.processedMessageIds.has(txId)) continue;

        if (this.isMessageTransaction(tx)) {
          try {
            // Process message transaction silently
            await this.processMessageTransaction(tx, blockHash, blockTime);
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.debug("Error processing message transaction:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing block event:", error);
    }
  }
}

export const createWithdrawTransaction = async (
  toAddress: string,
  amountSompi: bigint
): Promise<void> => {
  try {
    console.log("Sending withdraw transaction:", {
      toAddress,
      amountSompi,
    });

    const walletStore = useWalletStore.getState();
    const accountService = walletStore.accountService;
    const password = walletStore.unlockedWallet?.password;

    if (!accountService) {
      throw new Error("Account service not initialized");
    }

    if (!password) {
      throw new Error("Wallet is locked. Please unlock your wallet first.");
    }

    // Create and send a native transaction (no payload)
    await accountService.createWithdrawTransaction(
      {
        address: new Address(toAddress),
        amount: amountSompi,
      },
      password
    );

    console.log("Withdraw transaction sent successfully");
  } catch (error) {
    console.error("Send withdraw transaction error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to send withdraw transaction"
    );
  }
};
