import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { TransactionId } from "../../types/transactions";
import { KasiaDB, DBNotFoundException } from "./db";

export type DbHandshake = {
  /**
   * `${tenantId}_${transactionId}`
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  conversationId: string;
  createdAt: Date;
  transactionId: TransactionId;
  contactId: string;
  /**
   * encrypted data shaped as `json(HandshakeBag)`
   */
  encryptedData: string;
};

export type HandshakeBag = {
  amount: number;
  fee?: number;
  content: string;
  fromMe: boolean;
};
export type Handshake = HandshakeBag &
  Omit<DbHandshake, "encryptedData"> & {
    __type: "handshake";
  };

export class HandshakeRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getHandshake(handshakeId: string): Promise<Handshake> {
    const result = await this.db.get("handshakes", handshakeId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbHandshakeToHandshake(result);
  }

  async getHandshakes(): Promise<Handshake[]> {
    return this.db
      .getAllFromIndex("handshakes", "by-tenant-id", this.tenantId)
      .then((dbHandshakes) => {
        return dbHandshakes.map((dbHandshake) => {
          return this._dbHandshakeToHandshake(dbHandshake);
        });
      });
  }

  async getHanshakesByConversationId(
    conversationId: string
  ): Promise<Handshake[]> {
    return this.db
      .getAllFromIndex("handshakes", "by-conversation-id", conversationId)
      .then((dbHandshakes) => {
        return dbHandshakes.map((dbHandshake) => {
          return this._dbHandshakeToHandshake(dbHandshake);
        });
      });
  }

  async saveHandshake(handshake: Omit<Handshake, "tenantId">): Promise<void> {
    await this.db.put(
      "handshakes",
      this._handshakeToDbHandshake({
        ...handshake,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async deleteHandshake(handshakeId: string): Promise<void> {
    await this.db.delete("handshakes", handshakeId);
    return;
  }

  private _handshakeToDbHandshake(handshake: Handshake): DbHandshake {
    return {
      id: `${handshake.tenantId}_${handshake.transactionId}`,
      transactionId: handshake.transactionId,
      conversationId: handshake.conversationId,
      createdAt: handshake.createdAt,
      contactId: handshake.contactId,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          amount: handshake.amount,
          fee: handshake.fee,
          content: handshake.content,
          fromMe: handshake.fromMe,
        } satisfies HandshakeBag),
        this.walletPassword
      ),
      tenantId: this.tenantId,
    };
  }

  private _dbHandshakeToHandshake(dbHandshake: DbHandshake): Handshake {
    const handshakeBag = JSON.parse(
      decryptXChaCha20Poly1305(dbHandshake.encryptedData, this.walletPassword)
    ) as HandshakeBag;

    return {
      id: dbHandshake.id,
      tenantId: dbHandshake.tenantId,
      contactId: dbHandshake.contactId,
      conversationId: dbHandshake.conversationId,
      createdAt: dbHandshake.createdAt,
      transactionId: dbHandshake.transactionId,
      fee: handshakeBag.fee,
      amount: handshakeBag.amount,
      content: handshakeBag.content,
      fromMe: handshakeBag.fromMe,
      __type: "handshake",
    };
  }
}
