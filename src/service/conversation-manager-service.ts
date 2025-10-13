import {
  ConversationEvents,
  HandshakePayload,
  SavedHandshakePayload,
} from "src/types/messaging.types";
import { v4 as uuidv4 } from "uuid";
import { ALIAS_LENGTH } from "../config/constants";
import { isAlias } from "../utils/alias-validator";
import { DBNotFoundException, Repositories } from "../store/repository/db";
import {
  Conversation,
  ActiveConversation,
  PendingConversation,
} from "../store/repository/conversation.repository";
import { Contact } from "../store/repository/contact.repository";
import { Handshake } from "../store/repository/handshake.repository";

export class ConversationManagerService {
  private static readonly STORAGE_KEY_PREFIX = "encrypted_conversations";
  private static readonly PROTOCOL_VERSION = 1;

  private conversationWithContactByConversationId: Map<
    string,
    { conversation: Conversation; contact: Contact }
  > = new Map();
  private aliasToConversation: Map<string, string> = new Map(); // alias -> conversationId
  private addressToConversation: Map<string, string> = new Map(); // kaspaAddress -> conversationId

  private constructor(
    private currentAddress: string,
    readonly repositories: Repositories,
    private events?: Partial<ConversationEvents>
  ) {}

  static async init(
    currentAddress: string,
    repositories: Repositories,
    events?: Partial<ConversationEvents>
  ) {
    const manager = new ConversationManagerService(
      currentAddress,
      repositories,
      events
    );
    await manager.loadConversations();

    return manager;
  }

  private get storageKey(): string {
    return `${ConversationManagerService.STORAGE_KEY_PREFIX}_${this.currentAddress}`;
  }

  public async loadConversations() {
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
          conversationAndContact.conversation.lastActivityAt = new Date();
          this.inMemorySyncronization(
            conversationAndContact.conversation,
            conversationAndContact.contact
          );

          this.repositories.conversationRepository.saveConversation(
            conversationAndContact.conversation
          );

          return {
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

      this.events?.onHandshakeInitiated?.(conversation, contact);

      return { conversation, contact };
    } catch (error) {
      this.events?.onError?.(error);
      throw error;
    }
  }

  /**
   * assumption: payload has been parse with this.parseHandshakePayload first
   */
  public async processHandshake(
    senderAddress: string,
    payload: HandshakePayload
  ): Promise<unknown> {
    try {
      // STEP 1 – look up strictly by sender address only
      const existingConversationAndContactByAddress =
        this.getConversationWithContactByAddress(senderAddress);

      console.log("conversation manager - processing handshake", { payload });

      if (existingConversationAndContactByAddress) {
        // for safety reasons, it would be better to update the alias only if received handshake date
        // is greater than last time time we touched the alias. it would allow the caller to not be
        // responsible for this check
        (
          existingConversationAndContactByAddress.conversation as unknown as ActiveConversation
        ).theirAlias = payload.alias;

        // if conversation was initiated by me, and not yet active, it becomes active.
        if (
          existingConversationAndContactByAddress.conversation.status !==
            "active" &&
          existingConversationAndContactByAddress.conversation.initiatedByMe
        ) {
          (
            existingConversationAndContactByAddress.conversation as unknown as ActiveConversation
          ).status = "active";
        }

        await this.repositories.conversationRepository.saveConversation(
          existingConversationAndContactByAddress.conversation
        );
        this.inMemorySyncronization(
          existingConversationAndContactByAddress.conversation,
          existingConversationAndContactByAddress.contact
        );
        return;
      }

      // STEP 3 – completely unknown (first contact ever)
      return this.processNewHandshake(payload, senderAddress);
    } catch (error) {
      this.events?.onError?.(error);
      throw error;
    }
  }

  public async createHandshakeResponse(conversationId: string): Promise<void> {
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
      await this.repositories.conversationRepository.saveConversation(
        activatedConversation
      );
      this.inMemorySyncronization(activatedConversation, contact);
      this.events?.onHandshakeCompleted?.(activatedConversation, contact);
    } else {
      conversation.lastActivityAt = new Date();
      // For active conversations, just update last activity
      await this.repositories.conversationRepository.saveConversation(
        conversation
      );
      this.inMemorySyncronization(conversation, contact);
    }
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

  public getConversationWithContactByConversationId(
    conversationId: string
  ): { conversation: Conversation; contact: Contact } | null {
    return (
      this.conversationWithContactByConversationId.get(conversationId) || null
    );
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

  public getAllConversationsWithContact(): {
    conversation: Conversation;
    contact: Contact;
  }[] {
    return Array.from(
      this.conversationWithContactByConversationId.values()
    ).map(({ conversation, contact }) => ({
      conversation: conversation,
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

  /**
   * Expected Legacy Format: "ciph_msg:1:handshake:{json}"
   *
   * Expected Format: "{json}"
   */
  public parseHandshakePayload(payloadString: string): HandshakePayload {
    // LEGACY HANDSHAKE FORMAT
    if (payloadString.startsWith("ciph_msg:1:handshake:")) {
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
        const payload: HandshakePayload = JSON.parse(jsonPart);
        this.validateHandshakePayload(payload);

        return payload;
      } catch {
        throw new Error("Invalid handshake JSON payload");
      }
    }

    // ASSUME IT'S THE NEW FORMAT
    try {
      const payload: HandshakePayload = JSON.parse(payloadString);
      this.validateHandshakePayload(payload);

      return payload;
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

  async hydrateFromSavedHanshaked(
    payload: SavedHandshakePayload,
    transactionId: string
  ): Promise<{ conversation: Conversation; contact: Contact }> {
    const contact = await this.repositories.contactRepository
      .getContactByKaspaAddress(payload.recipientAddress)
      .catch(async (error) => {
        if (error instanceof DBNotFoundException) {
          // create a new contact if not found
          const newContact: Contact = {
            id: uuidv4(),
            kaspaAddress: payload.recipientAddress,
            timestamp: new Date(payload.timestamp),
            name: undefined,
            tenantId: this.repositories.tenantId,
          };

          await this.repositories.contactRepository.saveContact(newContact);

          return newContact;
        }
        throw error;
      });

    const conversation = await this.repositories.conversationRepository
      .getConversationByContactId(contact.id)
      .catch(async (error) => {
        if (error instanceof DBNotFoundException) {
          const _conversation: Conversation = {
            id: uuidv4(),
            myAlias: payload.alias,
            theirAlias: payload.theirAlias || null, // use theirAlias if present (for offline handshakes)
            lastActivityAt: new Date(payload.timestamp),
            status: payload.theirAlias ? "active" : "pending", // mark as active if we have both aliases (offline handshake)
            initiatedByMe: true,
            contactId: contact.id,
            tenantId: this.repositories.tenantId,
          };

          await this.repositories.conversationRepository.saveConversation(
            _conversation
          );

          return _conversation;
        }
        throw error;
      });

    conversation.myAlias = payload.alias;
    conversation.lastActivityAt = new Date(payload.timestamp);

    // set theirAlias if present in payload (for offline handshakes)
    if (payload.theirAlias) {
      conversation.theirAlias = payload.theirAlias;
    }

    // mark as active if we now have both aliases (completed offline handshake)
    if (payload.theirAlias && conversation.myAlias) {
      conversation.status = "active";
    }

    await this.repositories.conversationRepository.saveConversation(
      conversation
    );

    this.inMemorySyncronization(conversation, contact);

    await this.repositories.savedHandshakeRepository.saveSavedHandshake({
      id: `${this.repositories.tenantId}_${transactionId}`,
      createdAt: new Date(),
    });

    return {
      conversation,
      contact,
    };
  }

  public generateUniqueAlias(): string {
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

    const myAlias = this.generateUniqueAlias();
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
      id: uuidv4(),
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

    // Version compatibility check
    if (
      payload.version &&
      payload.version > ConversationManagerService.PROTOCOL_VERSION
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
          conversationAndContact.conversation.status === "active" ||
          (conversationAndContact.conversation.status === "pending" &&
            conversationAndContact.conversation.initiatedByMe)
      )
      .forEach((conversationAndContact) => {
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

  /**
   * Create an offline handshake between two parties
   * @param partnerAddress The partner's Kaspa address
   * @param ourAliasForPartner Our alias for the partner
   * @param theirAliasForUs Their alias for us
   * @returns Object containing conversationId and contactId
   */
  public async createOffChainHandshake(
    partnerAddress: string,
    ourAliasForPartner: string,
    theirAliasForUs: string
  ): Promise<{ conversationId: string; contactId: string }> {
    // Check if contact already exists - for offline handshakes, we should only create new contacts
    let contact: Contact;
    try {
      await this.repositories.contactRepository.getContactByKaspaAddress(
        partnerAddress
      );
      throw new Error(`Cannot create handshake. Contact already exists.`);
    } catch (error) {
      if (error instanceof DBNotFoundException) {
        // Contact doesn't exist, create a new one
        const newContact = {
          id: uuidv4(),
          kaspaAddress: partnerAddress,
          timestamp: new Date(),
          name: undefined,
          tenantId: this.repositories.tenantId,
        };
        await this.repositories.contactRepository.saveContact(newContact);
        contact = newContact;
      } else {
        // throw it if its not our expected error
        throw error;
      }
    }

    // Create conversation
    const conversation: Conversation = {
      id: uuidv4(),
      myAlias: ourAliasForPartner,
      theirAlias: theirAliasForUs,
      lastActivityAt: new Date(),
      status: "active",
      initiatedByMe: true,
      contactId: contact.id,
      tenantId: this.repositories.tenantId,
    };

    await this.repositories.conversationRepository.saveConversation(
      conversation
    );

    // Create handshake records (both outgoing and incoming)
    const now = new Date();

    // Outgoing handshake (from us to partner)
    const outgoingHandshake: Omit<Handshake, "tenantId"> = {
      id: uuidv4(),
      conversationId: conversation.id,
      createdAt: now,
      transactionId: `offline_${Date.now()}_outgoing`,
      contactId: contact.id,
      amount: 0.2,
      fee: 0,
      content: `Offline handshake initiated with ${partnerAddress}`,
      fromMe: true,
      __type: "handshake",
    };

    // Incoming handshake (from partner to us)
    const incomingHandshake: Omit<Handshake, "tenantId"> = {
      id: uuidv4(),
      conversationId: conversation.id,
      createdAt: new Date(now.getTime() + 1000),
      transactionId: `offline_${Date.now()}_incoming`,
      contactId: contact.id,
      amount: 0.2,
      fee: 0,
      content: `Offline handshake response from ${partnerAddress}`,
      fromMe: false,
      __type: "handshake",
    };

    await Promise.all([
      this.repositories.handshakeRepository.saveHandshake(outgoingHandshake),
      this.repositories.handshakeRepository.saveHandshake(incomingHandshake),
    ]);

    // Update in-memory state
    this.inMemorySyncronization(conversation, contact);

    return {
      conversationId: conversation.id,
      contactId: contact.id,
    };
  }
}
