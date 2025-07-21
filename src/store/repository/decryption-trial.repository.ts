export type DbDecryptionTrial = {
  /**
   * // `${walletAddress}_${txId}`
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  transactionId: string;
  timestamp: Date;
};

export type DecryptionTrial = DbDecryptionTrial;
