import { decryptXChaCha20Poly1305, encryptXChaCha20Poly1305 } from "kaspa-wasm";
import { DBNotFoundException, KasiaDB } from "./db";

export type DbGroupMessage = {
  /**
   * unique id: tenantId_transactionId
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  /**
   * group_id (32 bytes hex)
   */
  groupId: string;
  /**
   * kaspa address of the sender
   */
  senderAddress: string;
  /**
   * epoch when the message was sent
   */
  epoch: number;
  /**
   * message id for replay protection (12 bytes hex)
   */
  messageId: string;
  /**
   * transaction id on chain
   */
  transactionId: string;
  /**
   * when the message was created
   */
  createdAt: Date;
  /**
   * encrypted data shaped as `json(GroupMessageBag)`
   */
  encryptedData: string;
};

export type GroupMessageBag = {
  /**
   * decrypted plaintext content
   */
  content: string;
  /**
   * whether this message was sent by us
   */
  isFromMe: boolean;
};

export type GroupMessage = GroupMessageBag &
  Omit<DbGroupMessage, "encryptedData">;

/**
 * Repository for storing decrypted group messages with replay protection
 */
export class GroupMessageRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getGroupMessage(messageId: string): Promise<GroupMessage> {
    const result = await this.db.get("groupMessages", messageId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbGroupMessageToGroupMessage(result);
  }

  async getGroupMessages(groupId: string): Promise<GroupMessage[]> {
    return this.db
      .getAllFromIndex("groupMessages", "by-tenant-id-group-id", [
        this.tenantId,
        groupId,
      ])
      .then((dbGroupMessages) => {
        return dbGroupMessages.map((dbGroupMessage) => {
          return this._dbGroupMessageToGroupMessage(dbGroupMessage);
        });
      });
  }

  async getGroupMessagesByEpoch(
    groupId: string,
    epoch: number
  ): Promise<GroupMessage[]> {
    return this.db
      .getAllFromIndex("groupMessages", "by-tenant-id-group-id-epoch", [
        this.tenantId,
        groupId,
        epoch,
      ])
      .then((dbGroupMessages) => {
        return dbGroupMessages.map((dbGroupMessage) => {
          return this._dbGroupMessageToGroupMessage(dbGroupMessage);
        });
      });
  }

  async saveGroupMessage(
    groupMessage: Omit<GroupMessage, "tenantId">
  ): Promise<void> {
    await this.db.put(
      "groupMessages",
      this._groupMessageToDbGroupMessage({
        ...groupMessage,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async deleteGroupMessage(messageId: string): Promise<void> {
    await this.db.delete("groupMessages", messageId);
    return;
  }

  async deleteGroupMessages(groupId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "groupMessages",
      "by-tenant-id-group-id",
      [this.tenantId, groupId]
    );

    await Promise.all(keys.map((k) => this.db.delete("groupMessages", k)));
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "groupMessages",
      "by-tenant-id",
      tenantId
    );

    await Promise.all(keys.map((k) => this.db.delete("groupMessages", k)));
  }

  /**
   * Check if a message ID has been seen for replay protection
   */
  async hasMessageId(
    groupId: string,
    senderAddress: string,
    epoch: number,
    messageId: string
  ): Promise<boolean> {
    const existingMessages = await this.db.getAllFromIndex(
      "groupMessages",
      "by-tenant-id-group-id-epoch",
      [this.tenantId, groupId, epoch]
    );

    return existingMessages.some(
      (msg) =>
        msg.senderAddress === senderAddress && msg.messageId === messageId
    );
  }

  async saveBulk(
    groupMessages: Omit<GroupMessage, "tenantId">[]
  ): Promise<void> {
    const tx = this.db.transaction("groupMessages", "readwrite");
    const store = tx.objectStore("groupMessages");

    for (const groupMessage of groupMessages) {
      // check if message already exists
      const existing = await store.get(groupMessage.id);
      if (!existing) {
        await store.put(
          this._groupMessageToDbGroupMessage({
            ...groupMessage,
            tenantId: this.tenantId,
          })
        );
      }
    }

    await tx.done;
  }

  async reEncrypt(newPassword: string): Promise<void> {
    const transaction = this.db.transaction("groupMessages", "readwrite");
    const store = transaction.objectStore("groupMessages");
    const index = store.index("by-tenant-id");
    const cursor = await index.openCursor(IDBKeyRange.only(this.tenantId));

    if (!cursor) {
      return;
    }

    do {
      const dbGroupMessage = cursor.value;
      // decrypt with old password
      const decryptedData = decryptXChaCha20Poly1305(
        dbGroupMessage.encryptedData,
        this.walletPassword
      );
      // re-encrypt with new password
      const reEncryptedData = encryptXChaCha20Poly1305(
        decryptedData,
        newPassword
      );
      // update in database
      await cursor.update({
        ...dbGroupMessage,
        encryptedData: reEncryptedData,
      });
    } while (await cursor.continue());
  }

  private _groupMessageToDbGroupMessage(
    groupMessage: GroupMessage
  ): DbGroupMessage {
    return {
      id: groupMessage.id,
      tenantId: groupMessage.tenantId,
      groupId: groupMessage.groupId,
      senderAddress: groupMessage.senderAddress,
      epoch: groupMessage.epoch,
      messageId: groupMessage.messageId,
      transactionId: groupMessage.transactionId,
      createdAt: groupMessage.createdAt,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          content: groupMessage.content,
          isFromMe: groupMessage.isFromMe,
        } satisfies GroupMessageBag),
        this.walletPassword
      ),
    };
  }

  private _dbGroupMessageToGroupMessage(
    dbGroupMessage: DbGroupMessage
  ): GroupMessage {
    const groupMessageBag = JSON.parse(
      decryptXChaCha20Poly1305(
        dbGroupMessage.encryptedData,
        this.walletPassword
      )
    ) as GroupMessageBag;

    return {
      id: dbGroupMessage.id,
      tenantId: dbGroupMessage.tenantId,
      groupId: dbGroupMessage.groupId,
      senderAddress: dbGroupMessage.senderAddress,
      epoch: dbGroupMessage.epoch,
      messageId: dbGroupMessage.messageId,
      transactionId: dbGroupMessage.transactionId,
      createdAt: dbGroupMessage.createdAt,
      content: groupMessageBag.content,
      isFromMe: groupMessageBag.isFromMe,
    };
  }
}
