import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { TransactionId } from "../../types/transactions";
import { TransactionStatus } from "../../types/all";
import { DBNotFoundException, KasiaDB } from "./db";

export type DbMessage = {
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
   * encrypted data shaped as `json(MessageBag)`
   */
  encryptedData: string;
};

export type FileData = {
  type: "file" | "image";
  name: string;
  size: number;
  mimeType: string;
  content: string;
  width?: number;
  height?: number;
};

export type MessageBag = {
  amount: number;
  fee?: number;
  fileData?: FileData;
  content: string;
  fromMe: boolean;
};
export type Message = MessageBag &
  Omit<DbMessage, "encryptedData"> & {
    __type: "message";
  };

export class MessageRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getMessage(messageId: string): Promise<Message> {
    const result = await this.db.get("messages", messageId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbMessageToMessage(result);
  }

  async doesExistsById(messageId: string): Promise<boolean> {
    return this.db.count("messages", messageId).then((count) => count > 0);
  }

  async getMessages(): Promise<Message[]> {
    return this.db
      .getAllFromIndex("messages", "by-tenant-id", this.tenantId)
      .then((dbMessages) => {
        return dbMessages.map((dbMessage) => {
          return this._dbMessageToMessage(dbMessage);
        });
      });
  }

  /**
   * returns null in case there is no messages
   */
  async getLastDbMessageByCreatedAt(): Promise<DbMessage | null> {
    const cursor = await this.db
      .transaction("messages", "readonly")
      .objectStore("messages")
      .index("by-tenant-id-created-at")
      .openCursor(IDBKeyRange.upperBound([this.tenantId, new Date()]), "prev");

    if (!cursor) {
      return null;
    }

    return cursor.value;
  }

  async getMessagesByConversationId(
    conversationId: string
  ): Promise<Message[]> {
    return this.db
      .getAllFromIndex("messages", "by-tenant-id-conversation-id", [
        this.tenantId,
        conversationId,
      ])
      .then((dbMessages) => {
        return dbMessages.map((dbMessage) => {
          return this._dbMessageToMessage(dbMessage);
        });
      });
  }

  async saveMessage(message: Omit<Message, "tenantId">): Promise<void> {
    await this.db.put(
      "messages",
      this._messageToDbMessage({
        ...message,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async reEncrypt(newPassword: string): Promise<void> {
    const transaction = this.db.transaction("messages", "readwrite");
    const store = transaction.objectStore("messages");
    const index = store.index("by-tenant-id");
    const cursor = await index.openCursor(IDBKeyRange.only(this.tenantId));

    if (!cursor) {
      return;
    }

    do {
      const dbMessage = cursor.value;
      // Decrypt with old password
      const decryptedData = decryptXChaCha20Poly1305(
        dbMessage.encryptedData,
        this.walletPassword
      );
      // Re-encrypt with new password
      const reEncryptedData = encryptXChaCha20Poly1305(
        decryptedData,
        newPassword
      );
      // Update in database
      await cursor.update({
        ...dbMessage,
        encryptedData: reEncryptedData,
      });
    } while (await cursor.continue());
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.db.delete("messages", messageId);
    return;
  }

  async saveBulk(messages: Omit<Message, "tenantId">[]): Promise<void> {
    const tx = this.db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");

    for (const message of messages) {
      // Check if message already exists
      const existing = await store.get(
        `${this.tenantId}_${message.transactionId}`
      );
      if (!existing) {
        await store.put(
          this._messageToDbMessage({
            ...message,
            tenantId: this.tenantId,
          })
        );
      }
    }

    await tx.done;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "messages",
      "by-tenant-id",
      tenantId
    );

    await Promise.all(keys.map((k) => this.db.delete("messages", k)));
  }

  private _messageToDbMessage(message: Message): DbMessage {
    return {
      id: `${message.tenantId}_${message.transactionId}`,
      transactionId: message.transactionId,
      conversationId: message.conversationId,
      createdAt: message.createdAt,
      contactId: message.contactId,
      status: message.status,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          fileData: message.fileData,
          amount: message.amount,
          fee: message.fee,
          content: message.content,
          fromMe: message.fromMe,
        } satisfies MessageBag),
        this.walletPassword
      ),
      tenantId: this.tenantId,
    };
  }

  private _dbMessageToMessage(dbMessage: DbMessage): Message {
    const messageBag = JSON.parse(
      decryptXChaCha20Poly1305(dbMessage.encryptedData, this.walletPassword)
    ) as MessageBag;

    return {
      id: dbMessage.id,
      tenantId: dbMessage.tenantId,
      contactId: dbMessage.contactId,
      conversationId: dbMessage.conversationId,
      createdAt: dbMessage.createdAt,
      transactionId: dbMessage.transactionId,
      status: dbMessage.status,
      fee: messageBag.fee,
      fileData: messageBag.fileData,
      amount: messageBag.amount,
      content: messageBag.content,
      fromMe: messageBag.fromMe,
      __type: "message",
    };
  }
}
