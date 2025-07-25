import { decryptXChaCha20Poly1305, encryptXChaCha20Poly1305 } from "kaspa-wasm";
import { DBNotFoundException, KasiaDB } from "./db";

export type ConversationStatus = "pending" | "active" | "rejected";

export type ActiveConversation = InternalConversation & {
  status: "active";
};

export type RejectedConversation = InternalConversation & {
  status: "rejected";
};

export type PendingConversation = InternalConversation & {
  status: "pending";
};

export type Conversation =
  | ActiveConversation
  | RejectedConversation
  | PendingConversation;

export type DbConversation = {
  /**
   * conversation ID
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  lastActivityAt: Date;
  status: ConversationStatus;
  contactId: string;
  initiatedByMe: boolean;
  /**
   * encrypted data shaped as `json(ConversationBag)`
   */
  encryptedData: string;
};

export type ConversationBag = {
  /**
   * unique alias shared with the recipient
   */
  myAlias: string;
  /**
   * unique recipient alias shared with the recipient
   * nullable if the conversation is initiated by me
   */
  theirAlias: string | null;
};
type InternalConversation = ConversationBag &
  Omit<DbConversation, "encryptedData">;

export class ConversationRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getConversation(conversationId: string): Promise<Conversation> {
    const result = await this.db.get("conversations", conversationId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbConversationToConversation(result);
  }

  async getConversationByContactId(contactId: string): Promise<Conversation> {
    const result = await this.db.getFromIndex(
      "conversations",
      "by-contact-id",
      contactId
    );

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbConversationToConversation(result);
  }

  async getConversations(): Promise<Conversation[]> {
    return this.db
      .getAllFromIndex("conversations", "by-tenant-id", this.tenantId)
      .then((dbConversations) => {
        return dbConversations.map((dbConversation) => {
          return this._dbConversationToConversation(dbConversation);
        });
      });
  }

  async saveConversation(
    conversation: Omit<Conversation, "tenantId">
  ): Promise<void> {
    await this.db.put(
      "conversations",
      this._conversationToDbConversation({
        ...conversation,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.db.delete("conversations", conversationId);
    return;
  }

  async updateLastActivity(
    conversationId: string,
    lastActivityAt: Date
  ): Promise<void> {
    const existingDBConversation = await this.db.get(
      "conversations",
      conversationId
    );

    if (!existingDBConversation) {
      throw new DBNotFoundException();
    }

    await this.db.put(
      "conversations",
      {
        ...existingDBConversation,
        lastActivityAt,
      },
      conversationId
    );
  }

  private _conversationToDbConversation(
    conversation: Conversation
  ): DbConversation {
    return {
      contactId: conversation.contactId,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          myAlias: conversation.myAlias,
          theirAlias: conversation.theirAlias,
        } satisfies ConversationBag),
        this.walletPassword
      ),
      id: conversation.id,
      initiatedByMe: conversation.initiatedByMe,
      lastActivityAt: conversation.lastActivityAt,
      status: conversation.status,
      tenantId: this.tenantId,
    };
  }

  private _dbConversationToConversation(
    dbConversation: DbConversation
  ): Conversation {
    const conversationBag = JSON.parse(
      decryptXChaCha20Poly1305(
        dbConversation.encryptedData,
        this.walletPassword
      )
    ) as ConversationBag;

    return {
      tenantId: dbConversation.tenantId,
      contactId: dbConversation.contactId,
      id: dbConversation.id,
      initiatedByMe: dbConversation.initiatedByMe,
      lastActivityAt: dbConversation.lastActivityAt,
      myAlias: conversationBag.myAlias,
      status: dbConversation.status,
      theirAlias: conversationBag.theirAlias,
    };
  }
}
