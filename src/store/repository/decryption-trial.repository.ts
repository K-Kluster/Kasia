import { KasiaDB, DBNotFoundException } from "./db";

export type DbDecryptionTrial = {
  /**
   * `${tenantId}_${txId}`
   * @note tenantId is automatically added upon saving
   */
  id: string;
};

export type DecryptionTrial = DbDecryptionTrial;

export class DecryptionTrialRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getDecryptionTrial(
    decryptionTrialId: string
  ): Promise<DecryptionTrial> {
    const result = await this.db.get("decryptionTrials", decryptionTrialId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return result;
  }

  async getDecryptionTrials(): Promise<DecryptionTrial[]> {
    return this.db.getAllFromIndex(
      "decryptionTrials",
      "by-tenant-id",
      this.tenantId
    );
  }

  /**
   * @param decryptionTrial id of the transaction to mark as failed, `tenantId` is automatically added
   */
  async saveDecryptionTrial(decryptionTrial: DecryptionTrial): Promise<string> {
    return this.db.put("decryptionTrials", {
      id: `${this.tenantId}_${decryptionTrial.id}`,
    });
  }

  async deleteDecryptionTrial(decryptionTrialId: string): Promise<void> {
    await this.db.delete("decryptionTrials", decryptionTrialId);
    return;
  }
}
