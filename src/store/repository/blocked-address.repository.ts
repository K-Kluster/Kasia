import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { KasiaDB, DBNotFoundException } from "./db";

export type DbBlockedAddress = {
  /**
   * `uuidv4()`
   */
  id: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  timestamp: Date;
  /**
   * encrypted data shaped as `json(BlockedAddressBag)`
   */
  encryptedData: string;
};

export type BlockedAddressBag = {
  kaspaAddress: string;
  reason?: string;
};

export type BlockedAddress = BlockedAddressBag &
  Omit<DbBlockedAddress, "encryptedData">;

export class BlockedAddressRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getBlockedAddressByKaspaAddress(
    kaspaAddress: string
  ): Promise<BlockedAddress> {
    const result = await this.getBlockedAddresses().then((addresses) => {
      return addresses.find((addr) => addr.kaspaAddress === kaspaAddress);
    });

    if (!result) {
      throw new DBNotFoundException();
    }

    return result;
  }

  async getBlockedAddresses(): Promise<BlockedAddress[]> {
    return this.db
      .getAllFromIndex("blockedAddresses", "by-tenant-id", this.tenantId)
      .then((dbBlockedAddresses) => {
        return dbBlockedAddresses.map((dbBlockedAddress) => {
          return this._dbBlockedAddressToBlockedAddress(dbBlockedAddress);
        });
      });
  }

  async isAddressBlocked(kaspaAddress: string): Promise<boolean> {
    try {
      await this.getBlockedAddressByKaspaAddress(kaspaAddress);
      return true;
    } catch (error) {
      if (error instanceof DBNotFoundException) {
        return false;
      }
      throw error;
    }
  }

  async saveBlockedAddress(
    blockedAddress: Omit<BlockedAddress, "tenantId">
  ): Promise<string> {
    // check if already blocked
    const isBlocked = await this.isAddressBlocked(blockedAddress.kaspaAddress);
    if (isBlocked) {
      throw new Error("Address is already blocked");
    }

    return this.db.put(
      "blockedAddresses",
      this._blockedAddressToDbBlockedAddress({
        ...blockedAddress,
        tenantId: this.tenantId,
      })
    );
  }

  async deleteBlockedAddress(kaspaAddress: string): Promise<void> {
    const blockedAddress =
      await this.getBlockedAddressByKaspaAddress(kaspaAddress);
    await this.db.delete("blockedAddresses", blockedAddress.id);
  }

  async saveBulk(
    blockedAddresses: Omit<BlockedAddress, "tenantId">[]
  ): Promise<void> {
    const tx = this.db.transaction("blockedAddresses", "readwrite");
    const store = tx.objectStore("blockedAddresses");

    for (const blockedAddress of blockedAddresses) {
      // check if address already exists
      const existing = await store.get(blockedAddress.id);
      if (!existing) {
        await store.put(
          this._blockedAddressToDbBlockedAddress({
            ...blockedAddress,
            tenantId: this.tenantId,
          })
        );
      }
    }

    await tx.done;
  }

  async reEncrypt(newPassword: string): Promise<void> {
    const transaction = this.db.transaction("blockedAddresses", "readwrite");
    const store = transaction.objectStore("blockedAddresses");
    const index = store.index("by-tenant-id");
    const cursor = await index.openCursor(IDBKeyRange.only(this.tenantId));
    if (!cursor) {
      return;
    }

    do {
      const dbBlockedAddress = cursor.value;
      // decrypt with old password
      const decryptedData = decryptXChaCha20Poly1305(
        dbBlockedAddress.encryptedData,
        this.walletPassword
      );
      // re-encrypt with new password
      const reEncryptedData = encryptXChaCha20Poly1305(
        decryptedData,
        newPassword
      );
      // update in database
      await cursor.update({
        ...dbBlockedAddress,
        encryptedData: reEncryptedData,
      });
    } while (await cursor.continue());
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const keys = await this.db.getAllKeysFromIndex(
      "blockedAddresses",
      "by-tenant-id",
      tenantId
    );

    await Promise.all(keys.map((k) => this.db.delete("blockedAddresses", k)));
  }

  private _blockedAddressToDbBlockedAddress(
    blockedAddress: BlockedAddress
  ): DbBlockedAddress {
    return {
      id: blockedAddress.id,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          kaspaAddress: blockedAddress.kaspaAddress,
          reason: blockedAddress.reason,
        } satisfies BlockedAddressBag),
        this.walletPassword
      ),
      timestamp: blockedAddress.timestamp,
      tenantId: this.tenantId,
    };
  }

  private _dbBlockedAddressToBlockedAddress(
    dbBlockedAddress: DbBlockedAddress
  ): BlockedAddress {
    const blockedAddressBag = JSON.parse(
      decryptXChaCha20Poly1305(
        dbBlockedAddress.encryptedData,
        this.walletPassword
      )
    ) as BlockedAddressBag;

    return {
      tenantId: dbBlockedAddress.tenantId,
      id: dbBlockedAddress.id,
      timestamp: dbBlockedAddress.timestamp,
      kaspaAddress: blockedAddressBag.kaspaAddress,
      reason: blockedAddressBag.reason,
    };
  }
}
