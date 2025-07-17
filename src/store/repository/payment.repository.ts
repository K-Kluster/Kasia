import { TransactionId } from "../../types/transactions";

export type DbPayment = {
  /**
   * `${walletAddress}_${timestamp}_${transactionId}`
   */
  //   key: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  conversationId: string;
  timestamp: Date;
  transactionId: TransactionId;
  authorAddressId: string;
  /**
   * encrypted data shaped as `json(PaymentBag)`
   */
  encryptedData: string;
};

export type PaymentBag = {
  amount: number;
  fee?: number;
};
export type Payment = PaymentBag & Omit<DbPayment, "encryptedData">;
