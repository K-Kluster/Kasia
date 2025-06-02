import {
  Address,
  Generator,
  kaspaToSompi,
  PaymentOutput,
  PendingTransaction,
  UtxoContext,
  UtxoProcessor,
  UtxoProcessorEvent,
  UtxoProcessorEventMap,
  IBalanceEvent,
  IPendingEvent,
  IMaturityEvent,
  Balance,
  UtxoEntry,
  IUtxosChanged,
} from "kaspa-wasm";
import { KaspaClient } from "../utils/all-in-one";
import { UnlockedWallet, WalletStorage } from "../utils/wallet-storage";
import EventEmitter from "eventemitter3";
import { encrypt_message } from "cipher";

// strictly typed events
type AccountServiceEvents = {
  balance: (balance: {
    mature: number;
    pending: number;
    outgoing: number;
    matureUtxoCount: number;
    pendingUtxoCount: number;
  }) => void;
  utxosChanged: (utxos: UtxoEntry[]) => void;
  transactionReceived: (transaction: any) => void;
};

type CreateTransactionArgs = {
  address: Address;
  amount: bigint;
  payload: string;
};

type SendMessageArgs = {
  toAddress: Address;
  message: string;
  password: string;
};

export class AccountService extends EventEmitter<AccountServiceEvents> {
  processor: UtxoProcessor;
  context: UtxoContext;
  networkId: string;

  // only populated when started
  isStarted: boolean = false;
  receiveAddress: Address | null = null;

  private historyOfEmittedTxIds: string[] = [];

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
  }

  private async _emitBalanceUpdate() {
    const balance = await this.context.balance;
    if (!balance) return;

    // Get UTXOs for counting
    const matureUtxos = this.context.getMatureRange(0, this.context.matureLength);
    const pendingUtxos = this.context.getPending();

    // Convert balance values from sompi to KAS
    const matureKAS = Number(balance.mature) / 100000000;
    const pendingKAS = Number(balance.pending) / 100000000;
    const outgoingKAS = Number(balance.outgoing) / 100000000;

    console.log("Balance update (in KAS):", {
      mature: matureKAS,
      pending: pendingKAS,
      outgoing: outgoingKAS,
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length,
      rawMature: balance.mature.toString(),
      rawPending: balance.pending.toString(),
      rawOutgoing: balance.outgoing.toString()
    });

    this.emit("balance", {
      mature: matureKAS,
      pending: pendingKAS,
      outgoing: outgoingKAS,
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length
    });
  }

  private async _fetchTransactionDetails(txId: string) {
    const maxRetries = 10; // Increased to 10 attempts
    const retryDelay = 2000; // Changed to 2 seconds between retries

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const baseUrl = this.networkId === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org';
        const response = await fetch(`${baseUrl}/transactions/${txId}?inputs=true&outputs=true&resolve_previous_outpoints=no`);
        
        if (response.status === 404) {
          console.log(`Transaction ${txId} not yet available in API (attempt ${attempt + 1}/${maxRetries}), retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch transaction details: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`Successfully fetched transaction details for ${txId} on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(`Error fetching transaction details for ${txId} after ${maxRetries} attempts:`, error);
          return null;
        }
        console.log(`Attempt ${attempt + 1}/${maxRetries} failed, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  }

  private async _onUtxoChanged(notification: IUtxosChanged) {
    console.log("Processing UTXO change:", notification);

    // Get all mature UTXOs for the UTXO update event
    const utxos = this.context.getMatureRange(0, this.context.matureLength);
    
    // Log UTXO details for debugging
    console.log("Current UTXOs:", utxos.map(utxo => ({
      transactionId: utxo.outpoint.transactionId,
      amount: Number(utxo.entry.amount) / 100000000,
      amountSompi: utxo.entry.amount.toString(),
      scriptPublicKey: utxo.entry.scriptPublicKey.toString(),
      isMature: true // Since we got it from getMatureRange
    })));
    
    // Emit the balance update
    this._emitBalanceUpdate();
    
    // Calculate total amount in sompi first, then convert to KAS
    const totalSompi = utxos.reduce((sum, utxo) => sum + utxo.entry.amount, BigInt(0));
    const totalKAS = Number(totalSompi) / 100000000;
    
    // Emit UTXO update
    console.log("UTXOs updated:", {
      count: utxos.length,
      matureLength: this.context.matureLength,
      totalAmount: totalKAS
    });
    this.emit("utxosChanged", utxos);

    // Fetch transaction details for new UTXOs with a 3-second delay
    if (notification.data.added) {
      console.log("Waiting 3 seconds before fetching transaction details...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      for (const utxo of notification.data.added) {
        if (utxo?.outpoint?.transactionId && !this.historyOfEmittedTxIds.includes(utxo.outpoint.transactionId)) {
          const txDetails = await this._fetchTransactionDetails(utxo.outpoint.transactionId);
          if (txDetails) {
            console.log("New transaction details:", txDetails);
            
            // Only process if it's a message transaction
            if (txDetails.payload && txDetails.payload.startsWith("636970685f6d73673a")) {
              console.log("Found new message transaction, emitting event");
              this.emit("transactionReceived", txDetails);
              
              // Add to history to prevent duplicate processing
              this.historyOfEmittedTxIds.push(utxo.outpoint.transactionId);
              
              // Keep history size manageable
              if (this.historyOfEmittedTxIds.length > 100) {
                this.historyOfEmittedTxIds.shift();
              }
            }
          }
        }
      }
    }
  }

  async start() {
    try {
      // Get the receive address from the wallet
      const initialReceiveAddress = this.unlockedWallet.publicKeyGenerator.receiveAddress(
        this.networkId,
        0
      );

      // Ensure it has the proper network prefix
      this.receiveAddress = this.ensureAddressPrefix(initialReceiveAddress);
      
      console.log("Using primary address for all operations:", this.receiveAddress.toString());

      // Initialize UTXO processor first
      console.log("Starting UTXO processor...");
      await this.processor.start();

      // Set up event listeners before doing anything else
      console.log("Setting up event listeners...");
      
      // Set up balance change listener
      this.processor.addEventListener("balance", async () => {
        console.log("Balance event received");
        await this._emitBalanceUpdate();
      });

      // Set up maturity change listener
      this.processor.addEventListener("maturity", async () => {
        console.log("Maturity event received");
        await this._emitBalanceUpdate();
      });

      // Set up pending change listener
      this.processor.addEventListener("pending", async () => {
        console.log("Pending event received");
        await this._emitBalanceUpdate();
      });

      // Only track primary address
      const addressesToTrack = [this.receiveAddress!];
      const addressStrings = addressesToTrack.map(addr => addr.toString());

      // First, get initial UTXOs from RPC
      console.log("Fetching initial UTXOs...");
      const utxoResponse = await this.rpcClient.rpc?.getUtxosByAddresses(addressStrings);
      
      if (utxoResponse && utxoResponse.entries && utxoResponse.entries.length > 0) {
        console.log(`Found ${utxoResponse.entries.length} initial UTXOs from RPC`);
      } else {
        console.log("No initial UTXOs found from RPC");
      }

      // Now track addresses in UTXO processor
      console.log("Starting address tracking for primary address...");
      await this.context.trackAddresses(addressesToTrack);

      // Wait for the UTXO processor to process any initial UTXOs
      await new Promise<void>((resolve) => {
        const maxAttempts = 10;
        let attempts = 0;
        
        const checkUtxos = async () => {
          const matureUtxos = this.context.getMatureRange(0, this.context.matureLength);
          const pendingUtxos = this.context.getPending();
          const balance = await this.context.balance;
          
          console.log("Checking UTXO processor state:", {
            matureUtxos: matureUtxos.length,
            pendingUtxos: pendingUtxos.length,
            hasBalance: !!balance,
            mature: balance ? Number(balance.mature) / 100000000 : 0,
            pending: balance ? Number(balance.pending) / 100000000 : 0
          });

          if (
            // Either we have UTXOs
            matureUtxos.length > 0 || pendingUtxos.length > 0 ||
            // Or we've confirmed there are none after a few attempts
            attempts >= maxAttempts
          ) {
            console.log("UTXO processor initialization complete");
            resolve();
          } else {
            attempts++;
            console.log(`Waiting for UTXO processor (attempt ${attempts}/${maxAttempts})...`);
            setTimeout(checkUtxos, 200);
          }
        };
        
        checkUtxos();
      });

      // Force an initial balance update
      await this._emitBalanceUpdate();

      // Set up RPC subscription for future UTXO changes
      console.log("Setting up UTXO subscription...");
      await this.rpcClient.subscribeToUtxoChanges(addressStrings, (notification) => {
        console.log("UTXO change notification received:", notification);
        this._onUtxoChanged(notification);
      });
      console.log("Successfully subscribed to UTXO changes");

      // Get initial state one more time to ensure we're up to date
      await this._emitBalanceUpdate();

      this.isStarted = true;
      console.log("Account service initialization complete");
    } catch (error) {
      console.error("Failed to initialize account service:", error);
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
      console.error("Failed to clean up UTXO subscription and processor:", error);
    }
  }

  public async createTransaction(
    transaction: CreateTransactionArgs,
    password: string
  ) {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    console.log("=== CREATING TRANSACTION ===");
    const primaryAddress = this.receiveAddress!;
    console.log("Creating transaction from primary address:", primaryAddress.toString());
    console.log("Change will go back to primary address:", primaryAddress.toString());
    console.log(`Destination: ${transaction.address.toString()}`);
    console.log(`Amount: ${Number(transaction.amount) / 100000000} KAS (${transaction.amount} sompi)`);
    console.log(`Payload length: ${transaction.payload.length / 2} bytes`);

    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    // Ensure the destination address has the proper prefix
    const destinationAddress = this.ensureAddressPrefix(transaction.address);

    const paymentOutput = new PaymentOutput(
      destinationAddress,
      transaction.amount
    );

    const generator = new Generator({
      changeAddress: primaryAddress, // Use primary address for change
      entries: this.context,
      outputs: [paymentOutput],
      payload: transaction.payload,
      priorityFee: BigInt(0),
      networkId: this.networkId,
    });

    try {
      console.log("Generating transaction...");
      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      if (!pendingTransaction) {
        throw new Error("should not happens");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();
      console.log(`Transaction requires signing ${addressesToSign.length} addresses:`);
      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i+1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction
        .addresses()
        .map(() => {
          console.log("Using primary address key for signing");
          return privateKeyGenerator.receiveKey(0);
        });

      // Sign the transaction
      console.log("Signing transaction...");
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      console.log("Submitting transaction to network...");
      const txId = await pendingTransaction.submit(this.rpcClient.rpc);
      console.log(`Transaction submitted with ID: ${txId}`);
      console.log("========================");

      return txId;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  public async estimateTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this._getGeneratorForTransaction(transaction).estimate();
  }

  public async estimateTransactionDetails(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    try {
      if (!transaction || !transaction.address) {
        throw new Error("Invalid transaction or address");
      }
      
      const availableUtxos = this.context.getMatureRange(0, this.context.matureLength);
      
      const generator = new Generator({
        changeAddress: this.receiveAddress!,
        entries: this.context,
        outputs: [new PaymentOutput(transaction.address, transaction.amount)],
        payload: transaction.payload,
        priorityFee: BigInt(0),
        networkId: this.networkId,
      });
      
      const summary = await generator.estimate();
      
      if (!summary || !summary.fees) {
        throw new Error("Estimation returned invalid result");
      }
      
      const result = {
        fees: Number(summary.fees) / 100000000,
        finalAmount: Number(summary.finalAmount) / 100000000,
        transactions: summary.transactions,
        utxos: summary.utxos
      };
      
      return result;
    } catch (error) {
      console.error("Error in estimateTransactionDetails:", error);
      throw error;
    }
  }

  public async estimateSendMessage(sendMessage: SendMessageArgs) {
    try {
      const minimumAmount = kaspaToSompi("0.19");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

      // Encrypt the message
    const encryptedMessage = encrypt_message(
      sendMessage.toAddress.toString(),
      sendMessage.message
    );

    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

      const payload = prefix + encryptedMessage.to_hex();
      
      // Use a direct approach, minimizing string operations on addresses
      return this.estimateTransactionDetails({
      address: sendMessage.toAddress,
      amount: minimumAmount,
        payload: payload,
    });
    } catch (error) {
      console.error("Error in estimateSendMessage:", error);
      throw error;
    }
  }

  public async sendMessage(sendMessage: SendMessageArgs) {
    const minimumAmount = kaspaToSompi("0.19");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    const destinationAddress = this.ensureAddressPrefix(sendMessage.toAddress);
    
    const addressString = destinationAddress.toString();
    
    const encryptedMessage = encrypt_message(
      addressString,
      sendMessage.message
    );
    
    const encryptedHex = encryptedMessage.to_hex();

    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
    
    const payload = prefix + encryptedHex;

    const txId = await this.createTransaction(
      {
        address: destinationAddress,
        amount: minimumAmount,
        payload: payload,
      },
      sendMessage.password
    );
    
    return txId;
  }

  /**
   * Helper function to handle SEC1 format compatibility
   * for pre-encrypted messages
   */
  private adjustForSEC1Format(encryptedHex: string): string {
    // Check if the key starts with 02 or 03 (compressed SEC1 format)
    const keyStart = encryptedHex.substring(24, 26);
    if (keyStart !== '02' && keyStart !== '03') {
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
    const paddedPublicKey = publicKeyWithoutPrefix.padEnd(64, '0');
    
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
    const minimumAmount = kaspaToSompi("0.19");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }
    
    // Ensure the destination address has the proper prefix
    const destinationAddress = this.ensureAddressPrefix(toAddress);
    console.log("Sending pre-encrypted message to:", destinationAddress.toString());
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
    if (addressString.includes(':')) {
      return address;
    }
    
    // Add appropriate prefix based on network
    let prefixedAddressString = addressString;
    if (this.networkId === 'testnet-10' || this.networkId === 'testnet-11') {
      prefixedAddressString = `kaspatest:${addressString}`;
    } else if (this.networkId === 'mainnet') {
      prefixedAddressString = `kaspa:${addressString}`;
    } else if (this.networkId === 'devnet') {
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

    return new Generator({
      changeAddress: primaryAddress,
      entries: this.context,
      outputs: [new PaymentOutput(destinationAddress, transaction.amount)],
      payload: transaction.payload,
      networkId: this.networkId,
      priorityFee: BigInt(0),
    });
  }
}
