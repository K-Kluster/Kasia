import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { TransactionId } from "../../types/transactions";
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

  async getMessagesByConversationId(
    conversationId: string
  ): Promise<Message[]> {
    return this.db
      .getAllFromIndex("messages", "by-conversation-id", conversationId)
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

  async deleteMessage(messageId: string): Promise<void> {
    await this.db.delete("messages", messageId);
    return;
  }

  private _messageToDbMessage(message: Message): DbMessage {
    return {
      id: `${message.tenantId}_${message.transactionId}`,
      transactionId: message.transactionId,
      conversationId: message.conversationId,
      createdAt: message.createdAt,
      contactId: message.contactId,
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
      fee: messageBag.fee,
      fileData: messageBag.fileData,
      amount: messageBag.amount,
      content: messageBag.content,
      fromMe: messageBag.fromMe,
      __type: "message",
    };
  }
}
