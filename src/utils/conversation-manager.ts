import {
  ConversationEvents,
  HandshakePayload,
} from "src/types/messaging.types";
import { v4 as uuidv4 } from "uuid";
import { ALIAS_LENGTH } from "../config/constants";
import { isAlias } from "./alias-validator";
import { DBNotFoundException, Repositories } from "../store/repository/db";
import {
  Conversation,
  ActiveConversation,
  PendingConversation,
} from "../store/repository/conversation.repository";
import { Contact } from "../store/repository/contact.repository";

export class ConversationManager {
  private static readonly STORAGE_KEY_PREFIX = "encrypted_conversations";
  private static readonly PROTOCOL_VERSION = 1;

  private conversationWithContactByConversationId: Map<
    string,
    { conversation: Conversation; contact: Contact }
  > = new Map();
  private aliasToConversation: Map<string, string> = new Map(); // alias -> conversationId
  private addressToConversation: Map<string, string> = new Map(); // kaspaAddress -> conversationId

  constructor(
    private currentAddress: string,
    readonly repositories: Repositories,
    private events?: Partial<ConversationEvents>
  ) {
    this.loadConversations();
  }

  private get storageKey(): string {
    return `${ConversationManager.STORAGE_KEY_PREFIX}_${this.currentAddress}`;
  }

  private async loadConversations() {
    try {
      // Clear existing data first
      this.conversationWithContactByConversationId.clear();
      this.aliasToConversation.clear();
      this.addressToConversation.clear();

      const conversations =
        await this.repositories.conversationRepository.getConversations();

      // note: this isn't optimized, we're loading contacts here while it could have been cached earlier and centralized
      const contacts = await this.repositories.contactRepository.getContacts();

      // Load conversations for current wallet
      conversations.forEach((conversation) => {
        const contact = contacts.find((c) => c.id === conversation.contactId);

        if (!contact) {
          return;
        }

        // Only load conversations that belong to the current wallet address
        if (
          contact.kaspaAddress &&
          this.isValidKaspaAddress(contact.kaspaAddress)
        ) {
          this.conversationWithContactByConversationId.set(conversation.id, {
            conversation,
            contact,
          });
          this.addressToConversation.set(contact.kaspaAddress, conversation.id);
          this.aliasToConversation.set(conversation.myAlias, conversation.id);
          if (conversation.theirAlias) {
            this.aliasToConversation.set(
              conversation.theirAlias,
              conversation.id
            );
          }
        }
      });
    } catch (error) {
      console.error("Failed to load conversations from storage:", error);
    }
  }

  public destroy() {
    // Remove cleanup interval clearing since we're removing the timeout functionality
  }

  public async initiateHandshake(recipientAddress: string): Promise<{
    payload: string;
    conversation: Conversation;
    contact: Contact;
  }> {
    try {
      // Validate recipient address format
      if (!this.isValidKaspaAddress(recipientAddress)) {
        throw new Error("Invalid Kaspa address format");
      }

      // Check if we already have an active conversation
      const existingConvId = this.addressToConversation.get(recipientAddress);
      if (existingConvId) {
        const conversationAndContact =
          this.conversationWithContactByConversationId.get(existingConvId);
        if (
          conversationAndContact &&
          conversationAndContact.conversation.status === "active"
        ) {
          throw new Error(
            "Active conversation already exists with this address"
          );
        }
        // Keep the first alias - reuse existing pending conversation
        if (
          conversationAndContact &&
          conversationAndContact.conversation.status === "pending"
        ) {
          // Create handshake payload with the existing alias (keeps first alias)
          const handshakePayload: HandshakePayload = {
            type: "handshake",
            alias: conversationAndContact.conversation.myAlias, // Keep the original alias
            timestamp: Date.now(),
            conversationId: conversationAndContact.conversation.id,
            version: ConversationManager.PROTOCOL_VERSION,
            recipientAddress: recipientAddress,
            sendToRecipient: true,
          };

          // Format for blockchain transaction
          const payload = `ciph_msg:${
            ConversationManager.PROTOCOL_VERSION
          }:handshake:${JSON.stringify(handshakePayload)}`;

          // Update last activity to show it's still active
          conversationAndContact.conversation.lastActivityAt = new Date();
          this.inMemorySyncronization(
            conversationAndContact.conversation,
            conversationAndContact.contact
          );

          // Note: Not triggering onHandshakeInitiated again since it's a retry
          return {
            payload,
            conversation: conversationAndContact.conversation,
            contact: conversationAndContact.contact,
          };
        }
      }

      // Generate new conversation with unique alias (only for truly new handshakes)
      const { conversation, contact } = await this.createNewConversation(
        recipientAddress,
        true
      );

      // Create handshake payload - initial handshake is sent directly to recipient
      const handshakePayload: HandshakePayload = {
        type: "handshake",
        alias: conversation.myAlias,
        timestamp: Date.now(),
        conversationId: conversation.id,
        version: ConversationManager.PROTOCOL_VERSION,
        recipientAddress: recipientAddress,
        sendToRecipient: true, // Flag to indicate this should be sent to recipient
      };

      // Format for blockchain transaction
      const payload = `ciph_msg:${
        ConversationManager.PROTOCOL_VERSION
      }:handshake:${JSON.stringify(handshakePayload)}`;

      this.events?.onHandshakeInitiated?.(conversation, contact);

      return { payload, conversation, contact };
    } catch (error) {
      this.events?.onError?.(error);
      throw error;
    }
  }

  public async processHandshake(
    senderAddress: string,
    payloadString: string
  ): Promise<unknown> {
    try {
      const payload = this.parseHandshakePayload(payloadString);
      this.validateHandshakePayload(payload);

      // STEP 1 – look up strictly by conversationId only
      const existingConversationAndContactByConversationId =
        this.conversationWithContactByConversationId.get(
          payload.conversationId
        );

      if (existingConversationAndContactByConversationId) {
        // ------- this is a replay of a message we already handled -------
        // keep the guard so we don't downgrade on refresh
        if (
          payload.isResponse &&
          existingConversationAndContactByConversationId.conversation.status ===
            "pending"
        ) {
          // Promote the existing pending conversation to active *in-place* so any listeners that hold the original object see the change immediately.
          (
            existingConversationAndContactByConversationId as unknown as ActiveConversation
          ).status = "active";
          this.inMemorySyncronization(
            existingConversationAndContactByConversationId.conversation,
            existingConversationAndContactByConversationId.contact
          );
          this.events?.onHandshakeCompleted?.(
            existingConversationAndContactByConversationId.conversation,
            existingConversationAndContactByConversationId.contact
          );
        }
        return; // ⬅ nothing else to do
      }

      // STEP 2 – we didn't find that ID, but do we know the address?
      const existingByAddress =
        this.addressToConversation.get(senderAddress) &&
        this.conversationWithContactByConversationId.get(
          this.addressToConversation.get(senderAddress)!
        );

      if (existingByAddress && !payload.isResponse) {
        // ---------- peer lost cache & is initiating again ----------
        // create a *new* pending conversation linked to the new ID
        return this.processNewHandshake(payload, senderAddress);
      }

      // STEP 3 – completely unknown (first contact ever)
      return this.processNewHandshake(payload, senderAddress);
    } catch (error) {
      this.events?.onError?.(error);
      throw error;
    }
  }

  public createHandshakeResponse(conversationId: string): string {
    const conversationAndContact =
      this.conversationWithContactByConversationId.get(conversationId);
    if (!conversationAndContact) {
      throw new Error("Conversation not found for handshake response");
    }

    const { conversation, contact } = conversationAndContact;

    // Allow responses for both pending and active conversations (for cache recovery)
    if (conversation.status !== "pending" && conversation.status !== "active") {
      throw new Error("Invalid conversation status for handshake response");
    }

    if (!conversation.theirAlias) {
      throw new Error("Cannot create response without their alias");
    }

    // Update conversation status to active when creating response (if not already)
    if (conversation.status !== "active") {
      const activatedConversation: ActiveConversation = {
        ...conversation,
        status: "active",
        lastActivityAt: new Date(),
      };
      this.inMemorySyncronization(activatedConversation, contact);
      this.events?.onHandshakeCompleted?.(activatedConversation, contact);
    } else {
      // For active conversations, just update last activity
      conversation.lastActivityAt = new Date();
      this.inMemorySyncronization(conversation, contact);
    }

    const responsePayload: HandshakePayload = {
      type: "handshake",
      alias: conversation.myAlias,
      theirAlias: conversation.theirAlias, // Include their alias in response
      timestamp: Date.now(),
      conversationId: conversation.id, // Use our conversation ID
      version: ConversationManager.PROTOCOL_VERSION,
      recipientAddress: contact.kaspaAddress, // Include their address
      sendToRecipient: false, // Set to false to use standard encryption
      isResponse: true,
    };

    return `ciph_msg:${
      ConversationManager.PROTOCOL_VERSION
    }:handshake:${JSON.stringify(responsePayload)}`;
  }

  public getConversationWithContactByAlias(
    alias: string
  ): { conversation: Conversation; contact: Contact } | null {
    const convId = this.aliasToConversation.get(alias);
    return convId
      ? this.conversationWithContactByConversationId.get(convId) || null
      : null;
  }

  public getConversationWithContactByAddress(
    address: string
  ): { conversation: Conversation; contact: Contact } | null {
    const convId = this.addressToConversation.get(address);
    return convId
      ? this.conversationWithContactByConversationId.get(convId) || null
      : null;
  }

  public getActiveConversationsWithContact(): {
    conversation: ActiveConversation;
    contact: Contact;
  }[] {
    return Array.from(this.conversationWithContactByConversationId.values())
      .filter(({ conversation }) => conversation.status === "active")
      .map(({ conversation, contact }) => ({
        conversation: conversation as ActiveConversation,
        contact,
      }));
  }

  public getPendingConversationsWithContact(): {
    conversation: PendingConversation;
    contact: Contact;
  }[] {
    return Array.from(this.conversationWithContactByConversationId.values())
      .filter(({ conversation }) => conversation.status === "pending")
      .map(({ conversation, contact }) => ({
        conversation: conversation as PendingConversation,
        contact,
      }));
  }

  public updateLastActivity(conversationId: string): void {
    const conversationWithContact =
      this.conversationWithContactByConversationId.get(conversationId);
    if (conversationWithContact) {
      conversationWithContact.conversation.lastActivityAt = new Date();
      this.inMemorySyncronization(
        conversationWithContact.conversation,
        conversationWithContact.contact
      );
    }
  }

  public async removeConversation(conversationId: string): Promise<boolean> {
    const conversationWithContact =
      this.conversationWithContactByConversationId.get(conversationId);
    if (!conversationWithContact) return false;

    const { conversation, contact } = conversationWithContact;

    this.conversationWithContactByConversationId.delete(conversationId);
    this.addressToConversation.delete(contact.kaspaAddress);
    this.aliasToConversation.delete(conversation.myAlias);
    if (conversation.theirAlias) {
      this.aliasToConversation.delete(conversation.theirAlias);
    }

    // remove from storage
    await this.repositories.contactRepository.deleteContact(contact.id);
    await this.repositories.conversationRepository.deleteConversation(
      conversation.id
    );

    return true;
  }

  public async updateConversation(
    conversation: Pick<Conversation, "id"> & Partial<Conversation>
  ) {
    // Validate the conversation
    if (!conversation.id) {
      throw new Error("Invalid conversation: missing required fields");
    }

    // Get the existing conversation
    const existing = this.conversationWithContactByConversationId.get(
      conversation.id
    );
    if (!existing) {
      throw new Error("Conversation not found");
    }

    const { conversation: existingConversation, contact: existingContact } =
      existing;

    // Update the conversation
    const updatedConversation = {
      ...existingConversation,
      ...conversation,
      lastActivityAt: new Date(),
    };
    this.conversationWithContactByConversationId.set(conversation.id, {
      conversation: updatedConversation,
      contact: existingContact,
    });

    // If status changed to active, trigger the completion event
    if (
      existingConversation.status === "pending" &&
      conversation.status === "active"
    ) {
      this.events?.onHandshakeCompleted?.(updatedConversation, existingContact);
    }

    // @TODO(indexdb): useless?
    // // Update mappings
    // if (existingContact.kaspaAddress) {
    //   this.addressToConversation.set(
    //     existingContact.kaspaAddress,
    //     conversation.conversationId
    //   );
    // }

    if (conversation.myAlias) {
      this.aliasToConversation.set(conversation.myAlias, conversation.id);
    }

    if (conversation.theirAlias) {
      this.aliasToConversation.set(conversation.theirAlias, conversation.id);
    }

    // save to storage
    await this.repositories.conversationRepository.saveConversation({
      ...updatedConversation,
    });
  }

  private parseHandshakePayload(payloadString: string): HandshakePayload {
    // Expected format: "ciph_msg:1:handshake:{json}"
    const parts = payloadString.split(":");
    if (
      parts.length < 4 ||
      parts[0] !== "ciph_msg" ||
      parts[2] !== "handshake"
    ) {
      throw new Error("Invalid handshake payload format");
    }

    const jsonPart = parts.slice(3).join(":"); // Handle colons in JSON
    try {
      return JSON.parse(jsonPart);
    } catch {
      throw new Error("Invalid handshake JSON payload");
    }
  }

  private async createNewConversation(
    recipientAddress: string,
    initiatedByMe: boolean
  ): Promise<{ conversation: Conversation; contact: Contact }> {
    const contact = await this.repositories.contactRepository
      .getContactByKaspaAddress(recipientAddress)
      .catch(async (error) => {
        if (error instanceof DBNotFoundException) {
          // create a new contact if not found
          const newContact = {
            id: uuidv4(),
            kaspaAddress: recipientAddress,
            timestamp: new Date(),
            name: undefined,
            tenantId: this.repositories.tenantId,
          };

          await this.repositories.contactRepository.saveContact(newContact);

          return newContact;
        }
        throw error;
      });

    const conversation: Conversation = {
      id: uuidv4(),
      myAlias: this.generateUniqueAlias(),
      theirAlias: null,
      lastActivityAt: new Date(),
      status: "pending",
      initiatedByMe,
      contactId: contact.id,
      tenantId: this.repositories.tenantId,
    };

    await this.repositories.conversationRepository.saveConversation(
      conversation
    );

    this.inMemorySyncronization(conversation, contact);

    return {
      conversation,
      contact,
    };
  }

  private generateUniqueAlias(): string {
    let attempts = 0;
    const maxAttempts = 100; // Increased for better collision resistance

    while (attempts < maxAttempts) {
      const alias = this.generateAlias();
      if (!this.aliasToConversation.has(alias)) {
        return alias;
      }
      attempts++;
    }

    throw new Error("Failed to generate unique alias after maximum attempts");
  }

  private generateAlias(): string {
    const bytes = new Uint8Array(ALIAS_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private isValidKaspaAddress(address: string): boolean {
    // Check for both mainnet and testnet address formats
    return (
      (address.startsWith("kaspa:") || address.startsWith("kaspatest:")) &&
      address.length > 10
    );
  }

  /**
   * assumption: conversation does not exist yet
   *  -> you should call this method only if you are sure that the conversation does not exist yet
   */
  private async processNewHandshake(
    payload: HandshakePayload,
    senderAddress: string
  ) {
    const isMyNewAliasValid = isAlias(payload.theirAlias);

    const myAlias =
      payload.isResponse && isAlias(payload.theirAlias)
        ? payload.theirAlias
        : this.generateUniqueAlias();
    const status =
      payload.isResponse && isMyNewAliasValid ? "active" : "pending";

    const newContact = {
      id: uuidv4(),
      kaspaAddress: senderAddress,
      timestamp: new Date(),
      name: undefined,
      tenantId: this.repositories.tenantId,
    };

    const contactId =
      await this.repositories.contactRepository.saveContact(newContact);

    const conversation: Conversation = {
      id: payload.conversationId,
      myAlias,
      theirAlias: payload.alias,
      contactId,
      tenantId: this.repositories.tenantId,
      lastActivityAt: new Date(),
      status,
      initiatedByMe: false,
    };

    await this.repositories.conversationRepository.saveConversation(
      conversation
    );

    this.inMemorySyncronization(conversation, newContact);

    if (isMyNewAliasValid) {
      this.events?.onHandshakeCompleted?.(conversation, newContact);
    }
  }

  private validateHandshakePayload(payload: HandshakePayload) {
    if (!payload.alias || payload.alias.length !== ALIAS_LENGTH * 2) {
      throw new Error("Invalid alias format");
    }

    if (!payload.alias.match(/^[0-9a-f]+$/i)) {
      throw new Error("Alias must be hexadecimal");
    }

    if (!payload.conversationId || typeof payload.conversationId !== "string") {
      throw new Error("Invalid conversation ID");
    }

    // Version compatibility check
    if (
      payload.version &&
      payload.version > ConversationManager.PROTOCOL_VERSION
    ) {
      throw new Error("Unsupported protocol version");
    }
  }

  private inMemorySyncronization(conversation: Conversation, contact: Contact) {
    this.conversationWithContactByConversationId.set(conversation.id, {
      contact,
      conversation,
    });
    this.addressToConversation.set(contact.kaspaAddress, conversation.id);
    this.aliasToConversation.set(conversation.myAlias, conversation.id);
    if (conversation.theirAlias) {
      this.aliasToConversation.set(conversation.theirAlias, conversation.id);
    }
  }

  public getMonitoredConversations(): { alias: string; address: string }[] {
    const monitored: { alias: string; address: string }[] = [];

    Array.from(this.conversationWithContactByConversationId.values())
      .filter(
        (conversationAndContact) =>
          conversationAndContact.conversation.status === "active"
      )
      .forEach((conversationAndContact) => {
        // Monitor our own alias
        monitored.push({
          alias: conversationAndContact.conversation.myAlias,
          address: conversationAndContact.contact.kaspaAddress,
        });

        // Also monitor their alias if available
        if (conversationAndContact.conversation.theirAlias) {
          monitored.push({
            alias: conversationAndContact.conversation.theirAlias,
            address: conversationAndContact.contact.kaspaAddress,
          });
        }
      });

    return monitored;
  }

  /**
   * Restore a conversation from a backup
   * @param conversation The conversation to restore
   */
  async restoreConversation(
    conversation: Conversation,
    contact: Contact
  ): Promise<void> {
    // Validate conversation object
    if (!this.isValidConversation(conversation)) {
      console.error("Invalid conversation object:", conversation);
      return;
    }

    // Check if conversation already exists
    const existingConversationWithContact =
      this.conversationWithContactByConversationId.get(conversation.id);
    if (existingConversationWithContact) {
      // Update existing conversation
      const updatedConversation: Conversation = {
        ...existingConversationWithContact.conversation,
        ...conversation,
        lastActivityAt: new Date(),
      };
      this.conversationWithContactByConversationId.set(conversation.id, {
        conversation: updatedConversation,
        contact: existingConversationWithContact.contact,
      });

      await this.repositories.conversationRepository.saveConversation(
        updatedConversation
      );
    } else {
      // Add new conversation
      this.conversationWithContactByConversationId.set(conversation.id, {
        conversation,
        contact,
      });
    }

    // Update mappings
    this.addressToConversation.set(contact.kaspaAddress, conversation.id);
    this.aliasToConversation.set(conversation.myAlias, conversation.id);
    if (conversation.theirAlias) {
      this.aliasToConversation.set(conversation.theirAlias, conversation.id);
    }

    // Save to storage
    await this.repositories.contactRepository.saveContact(contact);
    await this.repositories.conversationRepository.saveConversation(
      conversation
    );
  }

  /**
   * Validate a conversation object
   * @param conversation The conversation to validate
   * @returns boolean indicating if the conversation is valid
   */
  public isValidConversation(
    conversation: unknown
  ): conversation is Conversation {
    if (typeof conversation !== "object" || conversation === null) {
      return false;
    }

    const conv = conversation as Partial<Conversation>;

    return (
      typeof conv.id === "string" &&
      typeof conv.myAlias === "string" &&
      (conv.theirAlias === null || typeof conv.theirAlias === "string") &&
      ["pending", "active", "rejected"].includes(
        conv.status as Conversation["status"]
      ) &&
      typeof conv.lastActivityAt === "object" &&
      typeof conv.initiatedByMe === "boolean"
    );
  }
}
