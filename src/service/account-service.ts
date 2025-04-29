import {
  Address,
  Generator,
  kaspaToSompi,
  PaymentOutput,
  PendingTransaction,
  UtxoContext,
  UtxoProcessor,
  UtxoProcessorEvent,
} from "kaspa-wasm";
import { KaspaClient } from "../utils/all-in-one";
import { UnlockedWallet, WalletStorage } from "../utils/wallet-storage";
import EventEmitter from "eventemitter3";
import { encrypt_message } from "cipher";

// stricly typed events
type AccountServiceEvents = {
  balance: (balance: number) => void;
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
  changeAddress: Address | null = null;

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

  async start() {
    this.receiveAddress = this.unlockedWallet.publicKeyGenerator.receiveAddress(
      this.networkId,
      0
    );

    this.changeAddress = this.unlockedWallet.publicKeyGenerator.changeAddress(
      this.networkId,
      0
    );

    this.processor.addEventListener(
      "utxo-proc-start",
      this._onProcessorStart.bind(this)
    );
    this.processor.addEventListener(
      "balance",
      this._onBalanceChanged.bind(this)
    );

    await this.processor.start();

    this.isStarted = true;
  }

  async stop() {
    this.processor.removeEventListener(
      "utxo-proc-start",
      this._onProcessorStart.bind(this)
    );

    // TODO: fix this
    // this.processor.removeEventListener(
    //   "balance",
    //   this._onBalanceChanged.bind(this)
    // );

    this.processor.stop();
  }

  private async _onProcessorStart() {
    await this.context.trackAddresses([
      this.receiveAddress!,
      this.changeAddress!,
    ]);

    const initialBalance = await this.context.balance;

    this.emit(
      "balance",
      initialBalance?.mature ? Number(initialBalance.mature) / 100000000 : 0
    );
  }

  private async _onBalanceChanged(event: UtxoProcessorEvent<"balance">) {
    this.emit(
      "balance",
      event.data.balance?.mature
        ? Number(event.data.balance.mature) / 100000000
        : 0
    );
  }

  public async createTransaction(
    transaction: CreateTransactionArgs,
    password: string
  ) {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    const paymentOutput = new PaymentOutput(
      transaction.address,
      transaction.amount
    );

    const generator = new Generator({
      changeAddress: this.changeAddress!,
      entries: this.context,
      outputs: [paymentOutput],
      payload: transaction.payload,
      priorityFee: BigInt(0),
      networkId: this.rpcClient.networkId,
    });

    try {
      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      if (!pendingTransaction) {
        throw new Error("should not happens");
      }

      const receiveAddress = this.receiveAddress!.toString();

      const privateKeys = pendingTransaction
        .addresses()
        .map((a: Address) =>
          a.toString() === receiveAddress
            ? privateKeyGenerator.receiveKey(0)
            : privateKeyGenerator.changeKey(0)
        );

      pendingTransaction.sign(privateKeys);

      const txId = await pendingTransaction.submit(this.rpcClient.rpc);

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

  public async estimateSendMessage(sendMessage: SendMessageArgs) {
    const minimumAmount = kaspaToSompi("0.12");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    const encryptedMessage = encrypt_message(
      sendMessage.toAddress.toString(),
      sendMessage.message
    );

    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    return this.estimateTransaction({
      address: sendMessage.toAddress,
      amount: minimumAmount,
      payload: prefix + encryptedMessage.to_hex(),
    });
  }

  public async sendMessage(sendMessage: SendMessageArgs) {
    const minimumAmount = kaspaToSompi("0.1");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    const encryptedMessage = encrypt_message(
      sendMessage.toAddress.toString(),
      sendMessage.message
    );

    const prefix = "ciph_msg:"
      .split("")
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");

    return this.createTransaction(
      {
        address: sendMessage.toAddress,
        amount: minimumAmount,
        payload: prefix + encryptedMessage.to_hex(),
      },
      sendMessage.password
    );
  }

  public getMatureUtxos() {
    if (!this.isStarted) {
      console.log('AccountService - Service not started');
      throw new Error("Account service is not started");
    }

    const matureUtxos = this.context.getMatureRange(0, this.context.matureLength);
    console.log('AccountService - Mature UTXOs:', {
      count: matureUtxos.length,
      matureLength: this.context.matureLength,
      utxos: matureUtxos
    });
    return matureUtxos;
  }

  private _getGeneratorForTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return new Generator({
      changeAddress: this.changeAddress!,
      entries: this.context,
      outputs: new PaymentOutput(transaction.address, transaction.amount),
      payload: transaction.payload,
    });
  }
}
