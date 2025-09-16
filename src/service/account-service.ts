import { EventEmitter } from "eventemitter3";
import {
  Address,
  UtxoProcessor,
  UtxoContext,
  UtxoEntry,
  PendingTransaction,
  GeneratorSummary,
  sompiToKaspaString,
  kaspaToSompi,
  PrivateKeyGenerator,
  Generator,
  RpcClient,
} from "kaspa-wasm";
import { encrypt_message } from "cipher";
import { PriorityFeeConfig } from "../types/all";
import { UnlockedWallet } from "../types/wallet.type";
import { TransactionId } from "../types/transactions";
import { useMessagingStore } from "../store/messaging.store";
import { PROTOCOL } from "../config/protocol";
import { PLACEHOLDER_ALIAS } from "../config/constants";
import { hexToBytes, getEncoder } from "../utils/payload-encoding";
import { WalletStorageService } from "./wallet-storage-service";
import { TransactionGeneratorService } from "./transaction-generator";
import { MAX_TX_FEE } from "../config/constants";
import { ensureAddressPrefix } from "../utils/network";
import { useAuthStore } from "../store/auth.store";

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
};

type SendMessageArgs = {
  toAddress: Address;
  message: string;
  amount?: bigint; // Optional custom amount, defaults to 0.2 KAS
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type EstimateSendFeesArgs = {
  toAddress: Address;
  message: string;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type EstimateSendBroadcastFeesArgs = EstimateSendFeesArgs & {
  channelName: string;
};

type SendMessageWithContextArgs = {
  toAddress: Address;
  message: string;
  theirAlias: string;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreateTransactionArgs = {
  address: Address;
  amount: bigint;
  payload: string | Uint8Array;
  payloadSize?: number;
  messageLength?: number;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreateWithdrawTransactionArgs = {
  address: Address;
  amount: bigint;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreateBroadcastTransactionArgs = {
  channelName: string;
  message: string;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreatePaymentWithMessageArgs = {
  address: Address;
  amount: bigint;
  payload: string | Uint8Array;
  originalMessage?: string; // Add the original message for outgoing record creation
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

export class AccountService extends EventEmitter<AccountServiceEvents> {
  processor: UtxoProcessor;
  context: UtxoContext;
  networkId: string;

  // only populated when started
  isStarted: boolean = false;
  receiveAddress: Address | null = null;

  // Add password field
  private password: string | null = null;

  private boundStart = this.start.bind(this);
  private boundStop = this.stop.bind(this);
  private boundHandleBalanceUpdate = this.handleBalanceUpdate.bind(this);

  constructor(
    private readonly rpc: RpcClient,
    private readonly unlockedWallet: UnlockedWallet
  ) {
    super();

    this.networkId = rpc.networkId?.toString() ?? "mainnet";

    this.processor = new UtxoProcessor({
      networkId: this.networkId,
      rpc: rpc,
    });
    this.context = new UtxoContext({ processor: this.processor });

    // Set password from unlocked wallet if available
    if (unlockedWallet.password) {
      this.password = unlockedWallet.password;
    }
  }

  private get recv(): Address {
    if (!this.receiveAddress)
      throw new Error("Receive address not initialized");
    return this.receiveAddress;
  }

  private get ctx(): UtxoContext {
    if (!this.context) throw new Error("UTXO context not initialized");
    return this.context;
  }

  private get pwd(): string {
    if (!this.password)
      throw new Error("Password not set - cannot perform operation");
    return this.password;
  }

  private handleBalanceUpdate() {
    console.log("Balance event received");
    this._emitBalanceUpdate();
  }

  private assertReady(): asserts this is AccountService & {
    receiveAddress: Address;
    context: UtxoContext;
  } {
    if (!this.isStarted || !this.rpc)
      throw new Error("Account service is not started");
    if (!this.rpc.isConnected) {
      throw new Error("Network Not Connected - Refresh Page or Restart App");
    }
    if (!this.receiveAddress)
      throw new Error("Receive address not initialized");
    if (!this.context) throw new Error("UTXO context not initialized");
    if (!this.password)
      throw new Error("Password not set - cannot perform operation");
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

  // this is a hacky approach needed to clear context and retract
  // should only be used after emptying the full wallet
  // we use this because generator / wasm doesn't have a graceful and clean solution
  private async retrackAfterFullSend() {
    if (!this.processor || !this.recv) return;
    try {
      this.context.free();
    } catch (error) {
      console.error("Error in retrackAfterFullSend:", error);
    }
    this.context = new UtxoContext({ processor: this.processor });
    await this.context.trackAddresses([this.recv]);
  }

  // Add method to set password
  public setPassword(password: string) {
    if (!password) {
      throw new Error("Password cannot be empty");
    }
    console.log("Setting password in AccountService");
    this.password = password;
  }

  async start() {
    try {
      console.log("starting account service");
      this.processor.setNetworkId(this.rpc.networkId?.toString() || "mainnet");

      // Get the receive address from the wallet
      const initialReceiveAddress =
        this.unlockedWallet.receivePublicKey.toAddress(this.networkId);

      // Ensure it has the proper network prefix
      this.receiveAddress = new Address(
        ensureAddressPrefix(initialReceiveAddress.toString(), this.networkId)
      );

      console.log(
        "Using primary address for all operations:",
        this.receiveAddress.toString()
      );

      // Set up event listeners
      console.log("Setting up event listeners...");
      this.processor.addEventListener("balance", this.boundHandleBalanceUpdate);

      // Add RPC connection event listeners
      this.rpc.removeEventListener("connect", this.boundStart);
      this.rpc.addEventListener("disconnect", this.boundStop);

      // start the processor
      console.log("Starting UTXO processor...");
      await this.processor.start();

      // Only track primary address
      const addressesToTrack = [this.receiveAddress];
      await this.context.trackAddresses(addressesToTrack);

      this.isStarted = true;
    } catch (error) {
      console.error("Failed to start account service:", error);
      throw error;
    }
  }

  async stop() {
    console.log("Stopping UTXO subscription and processor...");
    try {
      // Remove event listeners
      this.processor.removeEventListener(
        "balance",
        this.boundHandleBalanceUpdate
      );
      this.rpc.addEventListener("connect", this.boundStart);
      this.rpc.removeEventListener("disconnect", this.boundStop);

      await this.context.clear();
      // Stop the UTXO processor
      await this.processor.stop();

      // Clean up our local state
      this.isStarted = false;
      console.log(
        "Successfully cleaned up UTXO subscription, processor and context"
      );
    } catch (error) {
      console.error(
        "Failed to clean up UTXO subscription and processor:",
        error
      );
    }
  }

  async clear() {
    await this.stop();
    this.removeAllListeners();
    this.rpc.removeEventListener("connect", this.boundStart);
  }

  private validateTransactionFee(feeAmount: bigint): void {
    if (feeAmount > MAX_TX_FEE) {
      throw new Error(
        `Fee cannot exceed ${Number(MAX_TX_FEE) / 100_000_000} KAS`
      );
    }
  }

  private async processGeneratorTransactions(
    generator: Generator,
    postTransactionCallback?: () => Promise<void>
  ): Promise<string> {
    const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
      this.unlockedWallet,
      this.pwd
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    let pending: PendingTransaction | null;
    while ((pending = await generator.next())) {
      const txid = await this.signAndSubmitTransaction(
        pending,
        privateKeyGenerator
      );
      if (postTransactionCallback) {
        await postTransactionCallback();
      }
      return txid;
    }
    throw new Error("Failed to generate transaction");
  }

  private async signAndSubmitTransaction(
    pendingTransaction: PendingTransaction,
    privateKeyGenerator: PrivateKeyGenerator
  ): Promise<string> {
    // Check if password reauth is required before signing
    const amountToCheck =
      pendingTransaction.paymentAmount ?? pendingTransaction.feeAmount ?? 0n;
    if (useAuthStore.getState().requiresPasswordReauth(amountToCheck)) {
      throw new Error("PASSWORD_REAUTH_REQUIRED");
    }

    // Validate transaction fee (to make sure its not super high!) before proceeding
    this.validateTransactionFee(pendingTransaction.feeAmount);

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
    const txId: string = await pendingTransaction.submit(this.rpc);

    console.log(`Transaction submitted with ID: ${txId}`);
    console.log("========================");

    return txId;
  }

  public async createTransaction(
    transaction: CreateTransactionArgs
  ): Promise<TransactionId> {
    this.assertReady();

    if (!transaction.address) {
      throw new Error("Transaction address is required");
    }

    if (transaction.amount === null || transaction.amount === undefined) {
      throw new Error("Transaction amount is required");
    }

    console.log("=== CREATING TRANSACTION ===");
    const primaryAddress = this.recv;
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

    try {
      const generator = TransactionGeneratorService.createForTransaction({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: transaction.address,
        amount: transaction.amount,
        payload: transaction.payload,
        priorityFee: transaction.priorityFee,
      });

      console.log("Generating transaction...");
      return this.processGeneratorTransactions(generator);
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async createPaymentWithMessage(
    paymentTransaction: CreatePaymentWithMessageArgs
  ): Promise<TransactionId> {
    this.assertReady();
    if (!paymentTransaction.address)
      throw new Error("Transaction address is required");
    if (!paymentTransaction.amount)
      throw new Error("Transaction amount is required");

    try {
      const rawMature = this.ctx.balance?.mature ?? 0n;
      const isFullBalance: boolean = rawMature === paymentTransaction.amount;

      const generator = TransactionGeneratorService.createForPaymentOrWithdraw({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: paymentTransaction.address,
        amount: paymentTransaction.amount,
        payload: paymentTransaction.payload,
        priorityFee: paymentTransaction.priorityFee,
        isFullBalance,
      });

      const postCallback = isFullBalance
        ? () => this.retrackAfterFullSend()
        : undefined;

      return this.processGeneratorTransactions(generator, postCallback);
    } catch (error) {
      console.error("Error creating payment with message:", error);
      throw error;
    }
  }

  public async createWithdrawTransaction(
    withdrawTransaction: CreateWithdrawTransactionArgs
  ) {
    this.assertReady();
    if (!withdrawTransaction.address)
      throw new Error("Transaction address is required");
    if (!withdrawTransaction.amount)
      throw new Error("Transaction amount is required");

    try {
      const rawMature = this.ctx.balance?.mature ?? 0n;
      const isFullBalance: boolean = rawMature === withdrawTransaction.amount;

      const generator = TransactionGeneratorService.createForPaymentOrWithdraw({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: withdrawTransaction.address,
        amount: withdrawTransaction.amount,
        priorityFee: withdrawTransaction.priorityFee,
        isFullBalance,
      });

      const postCallback = isFullBalance
        ? () => this.retrackAfterFullSend()
        : undefined;

      return this.processGeneratorTransactions(generator, postCallback);
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async createCompoundTransaction() {
    this.assertReady();

    console.log("Consolidating all UTXOs to:", this.recv.toString());

    try {
      const matureBalance = this.ctx.balance?.mature;
      if (!matureBalance || matureBalance === 0n) {
        throw new Error("No mature UTXOs available for compound transaction");
      }

      const generator = TransactionGeneratorService.createForCompound({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
      });

      return this.processGeneratorTransactions(generator);
    } catch (error) {
      console.error("Error creating compound transaction:", error);
      throw error;
    }
  }

  public async createBroadcastTransaction(
    broadcastTransaction: CreateBroadcastTransactionArgs
  ): Promise<TransactionId> {
    this.assertReady();

    if (!broadcastTransaction.channelName) {
      throw new Error("Channel name is required for broadcast");
    }

    if (!broadcastTransaction.message.trim()) {
      throw new Error("Message content is required for broadcast");
    }

    console.log("=== CREATING BROADCAST TRANSACTION ===");
    const primaryAddress = this.recv;
    console.log(
      "Broadcasting from primary address:",
      primaryAddress.toString()
    );
    console.log(
      "Destination: Self (broadcast to own address)",
      primaryAddress.toString()
    );
    console.log(`Channel: #${broadcastTransaction.channelName}`);
    console.log(`Message: ${broadcastTransaction.message}`);

    try {
      // Create broadcast payload: ciph_msg:1:bcast:{channelName}:{messageContent}
      // Note: Broadcasts are never encrypted - they're plain text in the payload
      const protocolString = `ciph_msg:1:bcast:${broadcastTransaction.channelName.toLowerCase()}:${broadcastTransaction.message}`;
      const payloadBytes = getEncoder().encode(protocolString);

      console.log(`Broadcast payload length: ${payloadBytes.length} bytes`);

      // Use default broadcast amount (0.2 KAS)
      const broadcastAmount = kaspaToSompi("0.2");
      if (!broadcastAmount) {
        throw new Error("Failed to convert broadcast amount");
      }

      const generator = TransactionGeneratorService.createForTransaction({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: this.recv, // Broadcast to self
        amount: broadcastAmount,
        payload: payloadBytes,
        priorityFee: broadcastTransaction.priorityFee,
      });

      console.log("Generating broadcast transaction...");
      return this.processGeneratorTransactions(generator);
    } catch (error) {
      console.error("Error creating broadcast transaction:", error);
      throw error;
    }
  }

  public async sendMessage(
    sendMessage: SendMessageArgs
  ): Promise<TransactionId> {
    this.assertReady();
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

    const destinationAddress = new Address(
      ensureAddressPrefix(sendMessage.toAddress.toString(), this.networkId)
    );
    const addressString = destinationAddress.toString();

    // Check if the message is already encrypted (hex format)
    const isPreEncrypted = /^[0-9a-fA-F]+$/.test(sendMessage.message);

    let payload;
    if (isPreEncrypted) {
      // Message is already encrypted, just add the prefix
      payload = PROTOCOL.prefix.hex + sendMessage.message;
    } else {
      console.log("ENCRYPT MESSAGE", sendMessage.message);
      // Message needs to be encrypted
      const encryptedMessage = encrypt_message(
        addressString,
        sendMessage.message
      );

      payload = PROTOCOL.prefix.hex + encryptedMessage.to_hex();
    }

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      const txId = await this.createTransaction({
        address: destinationAddress,
        amount: messageAmount,
        payload: payload,
        priorityFee: sendMessage.priorityFee,
      });

      return txId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  // estimation with context 1:1 base64
  public async estimateSendMessageFees(
    sendMessage: EstimateSendFeesArgs
  ): Promise<GeneratorSummary> {
    this.assertReady();

    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    const destinationAddress = new Address(
      ensureAddressPrefix(sendMessage.toAddress.toString(), this.networkId)
    );
    const addressString = destinationAddress.toString();

    console.log("sendMessage:", {
      message: sendMessage.message,
      toAddress: sendMessage.toAddress.toString(),
      networkId: this.networkId,
    });

    // Message needs to be encrypted
    console.log("Encrypting message...");
    const encryptedMessage = encrypt_message(
      addressString,
      sendMessage.message
    );

    if (!encryptedMessage) {
      throw new Error("Failed to encrypt message");
    }
    const bytesData = hexToBytes(encryptedMessage.to_hex());
    const base64Data = btoa(String.fromCharCode(...bytesData));

    // Build the full protocol string with all components to match sendMessageWithContext
    const protocolString = `ciph_msg:1:comm:${PLACEHOLDER_ALIAS}:${base64Data}`;
    console.log("Encrypted protocol string:", protocolString);

    console.log("Final protocol string:", protocolString);
    const payload = getEncoder().encode(protocolString);
    console.log("Encoded payload:", payload);

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      return TransactionGeneratorService.createForTransaction({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: destinationAddress,
        amount: BigInt(0.2 * 100_000_000),
        payload: payload,
        priorityFee: sendMessage.priorityFee,
      }).estimate();
    } catch (error) {
      console.error("Error estimating transaction fees:", error);
      throw error;
    }
  }

  // estimation for unencrypted broadcast 1:1
  public async estimateSendBroadcastFees(
    sendBroadcast: EstimateSendBroadcastFeesArgs
  ): Promise<GeneratorSummary> {
    this.assertReady();

    if (!sendBroadcast.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendBroadcast.message) {
      throw new Error("Message is required");
    }

    const destinationAddress = new Address(
      ensureAddressPrefix(sendBroadcast.toAddress.toString(), this.networkId)
    );

    console.log("sendMessage:", {
      message: sendBroadcast.message,
      toAddress: sendBroadcast.toAddress.toString(),
      networkId: this.networkId,
    });

    // Message needs to be encrypted

    // Handle unencrypted message
    const protocolString = `ciph_msg:1:bcast:${sendBroadcast.channelName}:${sendBroadcast.message}`;
    console.log("Unencrypted protocol string:", protocolString);

    console.log("Final protocol string:", protocolString);
    const payload = getEncoder().encode(protocolString);
    console.log("Encoded payload:", payload);

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      return TransactionGeneratorService.createForTransaction({
        context: this.ctx,
        networkId: this.networkId,
        receiveAddress: this.recv,
        destinationAddress: destinationAddress,
        amount: BigInt(0.2 * 100_000_000),
        payload: payload,
        priorityFee: sendBroadcast.priorityFee,
      }).estimate();
    } catch (error) {
      console.error("Error estimating transaction fees:", error);
      throw error;
    }
  }

  public getMatureUtxos() {
    this.assertReady();
    return this.ctx.getMatureRange(0, this.ctx.matureLength);
  }

  public async sendMessageWithContext(sendMessage: SendMessageWithContextArgs) {
    this.assertReady();

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
    const conversationWithContact =
      conversationManager.getConversationWithContactByAlias(
        sendMessage.theirAlias
      );
    if (!conversationWithContact) {
      throw new Error("Could not find conversation for the given alias");
    }

    console.log("Encryption details:", {
      conversationPartnerAddress: conversationWithContact.contact.kaspaAddress,
      ourAddress: this.recv.toString(),
      theirAlias: sendMessage.theirAlias,
      destinationAddress: this.recv.toString(),
      conversation: conversationWithContact,
    });

    // Create the payload with conversation context
    const hexString = sendMessage.message; // This is already encrypted hex
    const hexBytes = hexToBytes(hexString);
    const base64String = btoa(String.fromCharCode(...hexBytes));

    // Build the full protocol string with all components
    const protocolString = `ciph_msg:1:comm:${sendMessage.theirAlias}:${base64String}`;
    const payloadBytes = getEncoder().encode(protocolString);

    const payload = payloadBytes;

    try {
      // Always send to our own address for self-send messages
      const destinationAddress = new Address(this.recv.toString());
      // Send to our own address
      const txId = await this.createTransaction({
        address: destinationAddress,
        amount: minimumAmount,
        payload: payload,
        priorityFee: sendMessage.priorityFee,
      });

      return txId;
    } catch (error) {
      console.error("Error sending message with context:", error);
      throw error;
    }
  }

  /**
   * is subject to race condition in case multiple waiters wants to consume these mature UTXOs
   */
  public async waitForMatureUTXO(): Promise<void> {
    if (this.ctx.matureLength > 0) {
      return;
    }

    return new Promise((res, rej) => {
      const oneTimeListen = () => {
        if (this.ctx.matureLength > 0) {
          this.processor.removeEventListener("maturity", oneTimeListen);
          res();
        }
      };

      this.processor.addEventListener("maturity", oneTimeListen);

      // timeout of 10 seconds
      setTimeout(() => {
        rej(new Error("Timeout while waiting for mature UTXO"));

        this.processor.removeEventListener("maturity", oneTimeListen);
      }, 10_000);
    });
  }
}
