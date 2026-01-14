import { decryptXChaCha20Poly1305, encryptXChaCha20Poly1305 } from "kaspa-wasm";
import { DBNotFoundException, KasiaDB } from "./db";

export type GroupStatus = "active" | "left";

export type DbGroup = {
  /**
   * group_id - 32 bytes hex string
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  /**
   * display name for the group
   */
  name: string;
  /**
   * kaspa address of the single admin (for v1)
   */
  adminAddress: string;
  /**
   * when the group was created locally
   */
  createdAt: Date;
  /**
   * when the group was last active (last message)
   */
  lastActivityAt: Date;
  /**
   * status of the group for this user
   */
  status: GroupStatus;
  /**
   * encrypted data shaped as `json(GroupBag)`
   */
  encryptedData: string;
};

export type GroupBag = {
  /**
   * group_seed - 32 bytes hex, admin only (null for regular members)
   * admin uses this to derive group_root_epoch for each epoch
   */
  groupSeed: string | null;
  /**
   * group_root_epoch - 32 bytes hex, current epoch's root
   * all members receive this from admin via COMM
   * used to derive sender keys for encryption/decryption
   */
  groupRootEpoch: string;
  /**
   * blinding_key - 32 bytes hex, shared among all members
   * derived from group_seed by admin, distributed to members
   * used to compute per-user blinded_group_ids for on-chain privacy
   */
  blindingKey: string;
  /**
   * current epoch for key derivation
   */
  currentEpoch: number;
  /**
   * list of group members
   */
  members: GroupMember[];
  /**
   * device_id - 16 bytes hex, persistent per device
   * used for deterministic msg_id construction
   */
  deviceId: string;
  /**
   * msg_counter - monotonic counter per (group_id, epoch, device_id)
   * reset to 0 on epoch change
   */
  msgCounter: number;
};

export type GroupMember = {
  /**
   * kaspa address of the member
   */
  address: string;
  /**
   * secp256k1 public key for signature verification (33 bytes compressed, hex)
   */
  signingPubKey: string;
  /**
   * epoch when this member joined
   */
  joinedAtEpoch: number;
};

// all members derive sender keys from the same group_root_epoch

export type Group = GroupBag & Omit<DbGroup, "encryptedData">;

export class GroupRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getGroup(groupId: string): Promise<Group> {
    const result = await this.db.get("groups", groupId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbGroupToGroup(result);
  }

  async getGroups(): Promise<Group[]> {
    return this.db
      .getAllFromIndex("groups", "by-tenant-id", this.tenantId)
      .then((dbGroups) => {
        return dbGroups.map((dbGroup) => {
          return this._dbGroupToGroup(dbGroup);
        });
      });
  }

  async getActiveGroups(): Promise<Group[]> {
    return this.db
      .getAllFromIndex("groups", "by-tenant-id-status", [
        this.tenantId,
        "active",
      ])
      .then((dbGroups) => {
        return dbGroups.map((dbGroup) => {
          return this._dbGroupToGroup(dbGroup);
        });
      });
  }

  async saveGroup(group: Omit<Group, "tenantId">): Promise<void> {
    await this.db.put(
      "groups",
      this._groupToDbGroup({
        ...group,
        tenantId: this.tenantId,
      })
    );
    return;
  }

  async updateLastActivity(
    groupId: string,
    lastActivityAt: Date
  ): Promise<void> {
    const existingDbGroup = await this.db.get("groups", groupId);

    if (!existingDbGroup) {
      throw new DBNotFoundException();
    }

    await this.db.put("groups", {
      ...existingDbGroup,
      lastActivityAt,
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.db.delete("groups", groupId);
    return;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "groups",
      "by-tenant-id",
      tenantId
    );

    await Promise.all(keys.map((k) => this.db.delete("groups", k)));
  }

  async saveBulk(groups: Omit<Group, "tenantId">[]): Promise<void> {
    const tx = this.db.transaction("groups", "readwrite");
    const store = tx.objectStore("groups");

    for (const group of groups) {
      // check if group already exists
      const existing = await store.get(group.id);
      if (!existing) {
        await store.put(
          this._groupToDbGroup({
            ...group,
            tenantId: this.tenantId,
          })
        );
      }
    }

    await tx.done;
  }

  async reEncrypt(newPassword: string): Promise<void> {
    const transaction = this.db.transaction("groups", "readwrite");
    const store = transaction.objectStore("groups");
    const index = store.index("by-tenant-id");
    const cursor = await index.openCursor(IDBKeyRange.only(this.tenantId));

    if (!cursor) {
      return;
    }

    do {
      const dbGroup = cursor.value;
      // decrypt with old password
      const decryptedData = decryptXChaCha20Poly1305(
        dbGroup.encryptedData,
        this.walletPassword
      );
      // re-encrypt with new password
      const reEncryptedData = encryptXChaCha20Poly1305(
        decryptedData,
        newPassword
      );
      // update in database
      await cursor.update({
        ...dbGroup,
        encryptedData: reEncryptedData,
      });
    } while (await cursor.continue());
  }

  private _groupToDbGroup(group: Group): DbGroup {
    return {
      id: group.id,
      tenantId: group.tenantId,
      name: group.name,
      adminAddress: group.adminAddress,
      createdAt: group.createdAt,
      lastActivityAt: group.lastActivityAt,
      status: group.status,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          groupSeed: group.groupSeed,
          groupRootEpoch: group.groupRootEpoch,
          blindingKey: group.blindingKey,
          currentEpoch: group.currentEpoch,
          members: group.members,
          deviceId: group.deviceId,
          msgCounter: group.msgCounter,
        } satisfies GroupBag),
        this.walletPassword
      ),
    };
  }

  private _dbGroupToGroup(dbGroup: DbGroup): Group {
    const groupBag = JSON.parse(
      decryptXChaCha20Poly1305(dbGroup.encryptedData, this.walletPassword)
    ) as GroupBag;

    return {
      id: dbGroup.id,
      tenantId: dbGroup.tenantId,
      name: dbGroup.name,
      adminAddress: dbGroup.adminAddress,
      createdAt: dbGroup.createdAt,
      lastActivityAt: dbGroup.lastActivityAt,
      status: dbGroup.status,
      groupSeed: groupBag.groupSeed,
      groupRootEpoch: groupBag.groupRootEpoch,
      blindingKey: groupBag.blindingKey,
      currentEpoch: groupBag.currentEpoch,
      members: groupBag.members,
      deviceId: groupBag.deviceId,
      msgCounter: groupBag.msgCounter,
    };
  }
}
