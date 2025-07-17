export type DbDecryptionTrial = {
  /**
   * // `${walletAddress}_${txId}`
   */
  //   key: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  transactionId: string;
  timestamp: Date;
};

export type DecryptionTrial = DbDecryptionTrial;
