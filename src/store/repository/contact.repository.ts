export type DbContact = {
  /**
   * `${walletAddress}_${contactAddress}`
   */
  //   key: string;
  /**
   * tenant is the selected wallet
   */
  tenantId: string;
  contactId: string;
  timestamp: Date;
  /**
   * encrypted data shaped as `json(ContactBag)`
   */
  encryptedData: string;
};

export type ContactBag = {
  name: string;
};
export type Contact = ContactBag & Omit<DbContact, "encryptedData">;
