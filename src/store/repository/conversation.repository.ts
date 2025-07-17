import { DBNotFoundException, KasiaDB } from "./db";

export type ConversationStatus = "pending" | "active" | "rejected";

export type DbConversation = {
  /**
   * conversation ID
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  lastActivity: Date;
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
export type Conversation = ConversationBag &
  Omit<DbConversation, "encryptedData">;

export class ConversationRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string
  ) {}

  async getConversation(conversationId: string): Promise<DbConversation> {
    const result = await this.db.get("conversations", conversationId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return result;
  }

  async getConversations(): Promise<DbConversation[]> {
    return this.db.getAllFromIndex(
      "conversations",
      "by-tenant-id",
      this.tenantId
    );
  }

  async saveConversation(conversation: DbConversation): Promise<void> {
    await this.db.put("conversations", conversation);
    return;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.db.delete("conversations", conversationId);
    return;
  }
}
