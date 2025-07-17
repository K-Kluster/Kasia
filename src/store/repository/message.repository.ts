import { TransactionId } from "../../types/transactions";

export type DbMessage = {
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
   * encrypted data shaped as `json(MessageBag)`
   */
  encryptedData: string;
};

export type MessageBag = {
  amount: number;
  fee?: number;
  fileData?: {
    type: string;
    name: string;
    size: number;
    mimeType: string;
    content: string;
  };
};
export type Message = MessageBag & Omit<DbMessage, "encryptedData">;
