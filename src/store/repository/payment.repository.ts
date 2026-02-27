import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { TransactionId } from "../../types/transactions";
import { TransactionStatus } from "../../types/all";
import { KasiaDB, DBNotFoundException } from "./db";

export type DbPayment = {
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
  status: TransactionStatus;
  /**
   * encrypted data shaped as `json(PaymentBag)`
   */
  encryptedData: string;
};

export type PaymentBag = {
  amount: number;
  fee?: number;
  content: string;
  fromMe: boolean;
};
export type Payment = PaymentBag &
  Omit<DbPayment, "encryptedData"> & {
    __type: "payment";
  };

export class PaymentRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getPayment(paymentId: string): Promise<Payment> {
    const result = await this.db.get("payments", paymentId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbPaymentToPayment(result);
  }

  async doesExistsById(paymentId: string): Promise<boolean> {
    return this.db.count("payments", paymentId).then((count) => count > 0);
  }

  async getPayments(): Promise<Payment[]> {
    return this.db
      .getAllFromIndex("payments", "by-tenant-id", this.tenantId)
      .then((dbPayments) => {
        return dbPayments.map((dbPayment) => {
          return this._dbPaymentToPayment(dbPayment);
        });
      });
  }

  async getPaymentsByConversationId(
    conversationId: string
  ): Promise<Payment[]> {
    return this.db
      .getAllFromIndex("payments", "by-tenant-id-conversation-id", [
        this.tenantId,
        conversationId,
      ])
      .then((dbPayments) => {
        return dbPayments.map((dbPayment) => {
          return this._dbPaymentToPayment(dbPayment);
        });
      });
  }

  /**
   * returns null in case there is no payments
   */
  async getLastDbPaymentByCreatedAt(): Promise<DbPayment | null> {
    const cursor = await this.db
      .transaction("payments", "readonly")
      .objectStore("payments")
      .index("by-tenant-id-created-at")
      .openCursor(IDBKeyRange.upperBound([this.tenantId, new Date()]), "prev");

    if (!cursor) {
      return null;
    }

    return cursor.value;
  }

  async savePayment(payment: Omit<Payment, "tenantId">): Promise<void> {
    await this.db.put(
      "payments",
      this._paymentToDbPayment({
        ...payment,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async deletePayment(paymentId: string): Promise<void> {
    await this.db.delete("payments", paymentId);
    return;
  }

  async saveBulk(payments: Omit<Payment, "tenantId">[]): Promise<void> {
    const tx = this.db.transaction("payments", "readwrite");
    const store = tx.objectStore("payments");

    for (const payment of payments) {
      // Check if payment already exists
      const existing = await store.get(
        `${this.tenantId}_${payment.transactionId}`
      );
      if (!existing) {
        await store.put(
          this._paymentToDbPayment({
            ...payment,
            tenantId: this.tenantId,
          })
        );
      }
    }

    await tx.done;
  }

  async reEncrypt(newPassword: string): Promise<void> {
    const transaction = this.db.transaction("payments", "readwrite");
    const store = transaction.objectStore("payments");
    const index = store.index("by-tenant-id");
    const cursor = await index.openCursor(IDBKeyRange.only(this.tenantId));

    if (!cursor) {
      return;
    }

    do {
      const dbPayment = cursor.value;
      // Decrypt with old password
      const decryptedData = decryptXChaCha20Poly1305(
        dbPayment.encryptedData,
        this.walletPassword
      );
      // Re-encrypt with new password
      const reEncryptedData = encryptXChaCha20Poly1305(
        decryptedData,
        newPassword
      );
      // Update in database
      await cursor.update({
        ...dbPayment,
        encryptedData: reEncryptedData,
      });
    } while (await cursor.continue());
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "payments",
      "by-tenant-id",
      tenantId
    );

    await Promise.all(keys.map((k) => this.db.delete("payments", k)));
  }

  private _paymentToDbPayment(payment: Payment): DbPayment {
    return {
      id: `${payment.tenantId}_${payment.transactionId}`,
      transactionId: payment.transactionId,
      conversationId: payment.conversationId,
      createdAt: payment.createdAt,
      contactId: payment.contactId,
      status: payment.status,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          amount: payment.amount,
          fee: payment.fee,
          content: payment.content,
          fromMe: payment.fromMe,
        } satisfies PaymentBag),
        this.walletPassword
      ),
      tenantId: this.tenantId,
    };
  }

  private _dbPaymentToPayment(dbPayment: DbPayment): Payment {
    const paymentBag = JSON.parse(
      decryptXChaCha20Poly1305(dbPayment.encryptedData, this.walletPassword)
    ) as PaymentBag;

    return {
      id: dbPayment.id,
      tenantId: dbPayment.tenantId,
      contactId: dbPayment.contactId,
      conversationId: dbPayment.conversationId,
      createdAt: dbPayment.createdAt,
      status: dbPayment.status,
      transactionId: dbPayment.transactionId,
      fee: paymentBag.fee,
      amount: paymentBag.amount,
      content: paymentBag.content,
      fromMe: paymentBag.fromMe,
      __type: "payment",
    };
  }
}
