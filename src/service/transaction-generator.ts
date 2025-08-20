import {
  Address,
  UtxoContext,
  Generator,
  PaymentOutput,
  FeeSource,
  IGeneratorSettingsObject,
  estimateTransactions,
  kaspaToSompi,
} from "kaspa-wasm";
import { PriorityFeeConfig } from "../types/all";
import { MAX_PRIORITY_FEE, MAX_TX_FEE } from "../config/constants";

export class TransactionGeneratorService {
  /**
   * Create generator for regular transactions with payload (messages)
   */
  static createForTransaction({
    context,
    networkId,
    receiveAddress,
    destinationAddress,
    amount,
    payload,
    priorityFee,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
    destinationAddress: Address;
    amount: bigint;
    payload: string | Uint8Array;
    priorityFee?: PriorityFeeConfig;
  }): Generator {
    // Check if this is a direct self-message (sending to our own receive address)
    const isDirectSelfMessage =
      destinationAddress.toString() === receiveAddress.toString();

    console.log(isDirectSelfMessage);
    // For regular transactions, always use the specified amount and destination
    // For self-messages, use empty outputs array to only use change output
    const outputs = isDirectSelfMessage
      ? []
      : [new PaymentOutput(destinationAddress, amount)];

    // Calculate additional fee based on fee rate difference
    let additionalFee = BigInt(0);

    if (priorityFee?.feerate && priorityFee.feerate > 1) {
      // Estimate transaction mass (typical message transaction ~2500-3000 grams)
      const estimatedMass = 2800; // grams - rough estimate for message transaction
      const baseFeeRate = 1; // sompi per gram
      const additionalFeeRate = priorityFee.feerate - baseFeeRate;
      additionalFee = BigInt(Math.floor(additionalFeeRate * estimatedMass));

      console.log("Calculated additional priority fee:", {
        selectedFeeRate: priorityFee.feerate,
        baseFeeRate,
        additionalFeeRate,
        estimatedMass,
        additionalFeeSompi: additionalFee.toString(),
        additionalFeeKAS: Number(additionalFee) / 100_000_000,
      });
    } else if (priorityFee?.amount && priorityFee.amount > 0) {
      additionalFee = priorityFee.amount;
      console.log(
        "Using explicit priority fee amount:",
        additionalFee.toString()
      );
    }

    console.log("Final priority fee for Generator:", additionalFee.toString());

    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: outputs,
      payload,
      networkId,
      priorityFee: additionalFee,
    };

    return new Generator(settings);
  }

  /**
   * Create generator for compound transactions (UTXO consolidation)
   */
  static createForCompound({
    context,
    networkId,
    receiveAddress,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
  }): Generator {
    // compound transaction - sweep operation to consolidate UTXOs
    // for compound tx, we pass undefined to outputs which means we dont need to specify priority fee
    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: undefined as unknown as PaymentOutput[],
      networkId,
    };

    return new Generator(settings);
  }

  /**
   * Create generator for payment and withdrawal transactions
   *
   * The behavior is a bit different than the others:
   *   * fees are either receiver or sender pays depending on if amount === balance
   */
  static async createForPaymentOrWithdraw({
    context,
    networkId,
    receiveAddress,
    destinationAddress,
    amount,
    payload,
    priorityFee,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
    destinationAddress: Address;
    amount: bigint;
    payload?: string | Uint8Array;
    priorityFee?: PriorityFeeConfig;
  }): Promise<Generator> {
    const matureBalance = context.balance?.mature ?? 0n;
    const isFullBalance = matureBalance === amount;

    const destinationAddressAsString = destinationAddress.toString();
    const receiveAddressAsString = receiveAddress.toString();

    let finalAmount = amount;

    console.log({ matureBalance, isFullBalance, amount });

    // case fullbalance, amount = amount - estimatedFees
    // to avoid internal mis-handling (utxo outgoing being stucked in utxo context)
    if (isFullBalance) {
      const baseSettings: IGeneratorSettingsObject = {
        changeAddress: new Address(receiveAddressAsString),
        entries: context,
        outputs: [
          new PaymentOutput(new Address(destinationAddressAsString), amount),
        ],
        networkId,
        priorityFee: { amount: BigInt(0), source: FeeSource.ReceiverPays },
        ...(payload && { payload }),
      };

      const summary = await estimateTransactions(baseSettings);

      // fool guard on estimated fees
      if (summary.fees > MAX_PRIORITY_FEE) {
        throw new Error("Unexpected high fees while trying to withdraw or pay");
      }

      finalAmount -= summary.fees;

      console.log({ summary, finalAmount });
    }

    // if full amount, we enforce the payer pays the fees
    const priorityFees: PriorityFeeConfig = isFullBalance
      ? { amount: BigInt(0), source: FeeSource.SenderPays }
      : priorityFee || {
          amount: BigInt(0),
          source: FeeSource.SenderPays,
        };

    const settings: IGeneratorSettingsObject = {
      entries: context,
      changeAddress: new Address(receiveAddressAsString),
      outputs: [
        new PaymentOutput(new Address(destinationAddressAsString), finalAmount),
      ],
      priorityFee: priorityFees,
      networkId,
      ...(payload && { payload }),
    };
    return new Generator(settings);
  }
}
