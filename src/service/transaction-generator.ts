import {
  Address,
  UtxoContext,
  Generator,
  PaymentOutput,
  FeeSource,
  IGeneratorSettingsObject,
} from "kaspa-wasm";
import { PriorityFeeConfig } from "../types/all";

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
   */
  static createForPaymentOrWithdraw({
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
  }): Generator {
    const matureBalance = context.balance?.mature ?? 0n;
    const isFullBalance = matureBalance === amount;

    // for full balance, use ReceiverPays (no choice). For partial, use SenderPays
    const finalPriorityFee = isFullBalance
      ? { amount: BigInt(0), source: FeeSource.ReceiverPays }
      : priorityFee || {
          amount: BigInt(0),
          source: FeeSource.SenderPays,
        };

    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: [new PaymentOutput(destinationAddress, amount)],
      networkId,
      priorityFee: finalPriorityFee,
      ...(payload && { payload }),
    };
    return new Generator(settings);
  }
}
