import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { KasiaDB, DBNotFoundException } from "./db";

export type DbContact = {
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
   * encrypted data shaped as `json(ContactBag)`
   */
  encryptedData: string;
};

export type ContactBag = {
  name?: string;
  kaspaAddress: string;
};
export type Contact = ContactBag & Omit<DbContact, "encryptedData">;

export class ContactRepository {
  constructor(
    readonly db: KasiaDB,
    readonly tenantId: string,
    readonly walletPassword: string
  ) {}

  async getContact(contactId: string): Promise<Contact> {
    const result = await this.db.get("contacts", contactId);

    if (!result) {
      throw new DBNotFoundException();
    }

    return this._dbContactToContact(result);
  }

  async getContactByKaspaAddress(kaspaAddress: string): Promise<Contact> {
    const result = await this.getContacts().then((contacts) => {
      return contacts.find((contact) => contact.kaspaAddress === kaspaAddress);
    });

    if (!result) {
      throw new DBNotFoundException();
    }

    return result;
  }

  async getContacts(): Promise<Contact[]> {
    return this.db
      .getAllFromIndex("contacts", "by-tenant-id", this.tenantId)
      .then((dbContacts) => {
        return dbContacts.map((dbContact) => {
          return this._dbContactToContact(dbContact);
        });
      });
  }

  async saveContact(contact: Omit<Contact, "tenantId">): Promise<string> {
    console.log(
      this._contactToDbContact({ ...contact, tenantId: this.tenantId })
    );
    return this.db.put(
      "contacts",
      this._contactToDbContact({ ...contact, tenantId: this.tenantId })
    );
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.db.delete("contacts", contactId);
    return;
  }

  private _contactToDbContact(contact: Contact): DbContact {
    return {
      id: contact.id,
      encryptedData: encryptXChaCha20Poly1305(
        JSON.stringify({
          name: contact.name,
          kaspaAddress: contact.kaspaAddress,
        } satisfies ContactBag),
        this.walletPassword
      ),
      timestamp: contact.timestamp,
      tenantId: this.tenantId,
    };
  }

  private _dbContactToContact(dbContact: DbContact): Contact {
    const contactBag = JSON.parse(
      decryptXChaCha20Poly1305(dbContact.encryptedData, this.walletPassword)
    ) as ContactBag;

    return {
      tenantId: dbContact.tenantId,
      id: dbContact.id,
      timestamp: dbContact.timestamp,
      name: contactBag.name,
      kaspaAddress: contactBag.kaspaAddress,
    };
  }
}
