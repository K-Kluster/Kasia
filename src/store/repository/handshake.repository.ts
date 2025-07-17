import { TransactionId } from "../../types/transactions";

export type DbHandshake = {
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
   * encrypted data shaped as `json(HandshakeBag)`
   */
  encryptedData: string;
};

export type HandshakeBag = {
  amount: number;
  fee?: number;
};
export type Handshake = HandshakeBag & Omit<DbHandshake, "encryptedData">;
