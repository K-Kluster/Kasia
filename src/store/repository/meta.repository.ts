export type MetadataV1 = {
  version: 1;
  /// last block time of historical fetching and storing success, per entities
  lastMessageBlockTime: number;
  lastPaymentBlockTime: number;
  lastHandshakeBlockTime: number;
  lastSavedHandshakeBlockTime: number;
  deterministicAliasesMigrated: boolean;
};

const defaultMetadata: MetadataV1 = {
  version: 1,
  lastMessageBlockTime: 0,
  lastPaymentBlockTime: 0,
  lastHandshakeBlockTime: 0,
  lastSavedHandshakeBlockTime: 0,
  deterministicAliasesMigrated: false,
};

export class MetaRespository {
  key: string;
  constructor(readonly tenantId: string) {
    this.key = `metadata_${tenantId}`;
  }

  /// If item doesn't exists, return defaults
  load(): MetadataV1 {
    const existing = localStorage.getItem(this.key);

    if (existing === null) {
      // store and return default
      this._storeComplete(defaultMetadata);

      return defaultMetadata;
    }

    try {
      return { ...defaultMetadata, ...JSON.parse(existing) };
    } catch (error) {
      // corrupted data
      console.error(error);
      return defaultMetadata;
    }
  }

  /**
   * forced to store all of the store because it doesn't support concurrent writes
   */
  store(data: Partial<MetadataV1>) {
    const current = this.load();

    localStorage.setItem(this.key, JSON.stringify({ ...current, ...data }));
  }

  erase() {
    localStorage.removeItem(this.key);
  }

  private _storeComplete(data: MetadataV1) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}
