import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { TransactionId } from "../../types/transactions";
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
      .getAllFromIndex("payments", "by-conversation-id", conversationId)
      .then((dbPayments) => {
        return dbPayments.map((dbPayment) => {
          return this._dbPaymentToPayment(dbPayment);
        });
      });
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

  private _paymentToDbPayment(payment: Payment): DbPayment {
    return {
      id: `${payment.tenantId}_${payment.transactionId}`,
      transactionId: payment.transactionId,
      conversationId: payment.conversationId,
      createdAt: payment.createdAt,
      contactId: payment.contactId,
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
      transactionId: dbPayment.transactionId,
      fee: paymentBag.fee,
      amount: paymentBag.amount,
      content: paymentBag.content,
      fromMe: paymentBag.fromMe,
      __type: "payment",
    };
  }
}
