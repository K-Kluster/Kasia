import {
  ConversationEvents,
  HandshakePayload,
  SavedHandshakePayload,
} from "src/types/messaging.types";
import { v4 as uuidv4 } from "uuid";
import { DBNotFoundException, Repositories } from "../store/repository/db";
import {
  Conversation,
  ActiveConversation,
  PendingConversation,
  ConversationVersion,
} from "../store/repository/conversation.repository";
import { Contact } from "../store/repository/contact.repository";
import { Handshake } from "../store/repository/handshake.repository";
import { deriveConversationAliases } from "../utils/deterministic-alias";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorageService } from "./wallet-storage-service";
import { useBlocklistStore } from "../store/blocklist.store";

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

  /**
   * Gets the private key for deriving deterministic aliases
   */
  private getPrivateKey(): string {
    const walletStore = useWalletStore.getState();
    if (!walletStore.unlockedWallet) {
      throw new Error("Wallet not unlocked - cannot derive aliases");
    }

    return WalletStorageService.getPrivateKey(
      walletStore.unlockedWallet
    ).toString();
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
          if (conversationAndContact.conversation.version === 1) {
            conversationAndContact.conversation.lastActivityAt = new Date();
            await this.repositories.conversationRepository.saveConversation(
              conversationAndContact.conversation
            );
            this.inMemorySyncronization(
              conversationAndContact.conversation,
              conversationAndContact.contact
            );
            return {
              conversation: conversationAndContact.conversation,
              contact: conversationAndContact.contact,
            };
          }

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
   * Create a discrete conversation - start monitoring for messages without sending a handshake.
   * Both parties independently derive the same deterministic aliases.
   * No on-chain transaction is required.
   */
  public async createDiscreteConversation(recipientAddress: string): Promise<{
    conversation: Conversation;
    contact: Contact;
  }> {
    try {
      // Validate recipient address format
      if (!this.isValidKaspaAddress(recipientAddress)) {
        throw new Error("Invalid Kaspa address format");
      }

      // Check if conversation already exists
      const existingConvId = this.addressToConversation.get(recipientAddress);
      if (existingConvId) {
        const conversationAndContact =
          this.conversationWithContactByConversationId.get(existingConvId);
        if (conversationAndContact) {
          throw new Error(
            "Conversation already exists with this address. Use the existing conversation."
          );
        }
      }

      // Get or create contact
      const contact = await this.repositories.contactRepository
        .getContactByKaspaAddress(recipientAddress)
        .catch(async (error) => {
          if (error instanceof DBNotFoundException) {
            // Create new contact
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

      // Derive deterministic aliases
      const privateKey = this.getPrivateKey();
      const { myAlias, theirAlias } = deriveConversationAliases(
        privateKey,
        recipientAddress
      );

      console.log(
        "[createDiscreteConversation] Derived aliases for",
        recipientAddress,
        "=> myAlias:",
        myAlias,
        "theirAlias:",
        theirAlias
      );

      // Create conversation in active state (no handshake needed)
      const conversation: ActiveConversation = {
        id: uuidv4(),
        myAlias,
        theirAlias,
        lastActivityAt: new Date(),
        status: "active", // Immediately active - no handshake required
        initiatedByMe: true,
        contactId: contact.id,
        tenantId: this.repositories.tenantId,
        version: 2,
      };

      await this.repositories.conversationRepository.saveConversation(
        conversation
      );

      this.inMemorySyncronization(conversation, contact);

      console.log(
        "[createDiscreteConversation] Created discrete conversation - now monitoring myAlias:",
        myAlias
      );

      return {
        conversation,
        contact,
      };
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
      // check if sender is blocked before processing handshake
      const blocklistStore = useBlocklistStore.getState();
      if (blocklistStore.isBlocked(senderAddress)) {
        console.log(
          `Conversation Manager - Rejecting handshake from blocked address: ${senderAddress}`
        );
        return; // don't process handshakes from blocked addresses
      }

      // STEP 1 – look up strictly by sender address only
      const existingConversationAndContactByAddress =
        this.getConversationWithContactByAddress(senderAddress);

      console.log("conversation manager - processing handshake", {
        payload,
        senderAddress,
      });

      if (existingConversationAndContactByAddress) {
        // Derive aliases to verify they match (sanity check for deterministic system)
        const privateKey = this.getPrivateKey();
        const { myAlias } = deriveConversationAliases(
          privateKey,
          senderAddress
        );

        console.log(
          "[processHandshake] Existing conversation - Derived myAlias:",
          myAlias,
          "Expected:",
          existingConversationAndContactByAddress.conversation.myAlias
        );

        // Verify aliases match (they should be deterministic)
        if (
          existingConversationAndContactByAddress.conversation.myAlias !==
          myAlias
        ) {
          console.warn(
            "[Alias Mismatch] Expected myAlias:",
            myAlias,
            "Got:",
            existingConversationAndContactByAddress.conversation.myAlias
          );
        }

        // if conversation was initiated by me, and not yet active, it becomes active.
        if (
          existingConversationAndContactByAddress.conversation.status !==
            "active" &&
          existingConversationAndContactByAddress.conversation.initiatedByMe
        ) {
          (
            existingConversationAndContactByAddress.conversation as unknown as ActiveConversation
          ).status = "active";
          console.log(
            "[processHandshake] Activated pending conversation that I initiated"
          );
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

      // STEP 2 – completely unknown (first contact ever)
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

  // clears in-memory (non db) state for a conversation by address
  // needed edge case of blocking > ublocking and tryint to re add contact
  public clearConversationByAddress(address: string): boolean {
    const conversationId = this.addressToConversation.get(address);
    if (!conversationId) return false;

    const conversationWithContact =
      this.conversationWithContactByConversationId.get(conversationId);
    if (!conversationWithContact) {
      // just clear the address mapping if conversation not found
      this.addressToConversation.delete(address);
      return true;
    }

    const { conversation } = conversationWithContact;

    // clear all in-memory maps
    this.conversationWithContactByConversationId.delete(conversationId);
    this.addressToConversation.delete(address);
    this.aliasToConversation.delete(conversation.myAlias);
    if (conversation.theirAlias) {
      this.aliasToConversation.delete(conversation.theirAlias);
    }

    return true;
  }

  public async setConversationVersionByAddress(
    address: string,
    version: ConversationVersion
  ): Promise<boolean> {
    const conversationWithContact =
      this.getConversationWithContactByAddress(address);
    if (!conversationWithContact) {
      return false;
    }

    if (conversationWithContact.conversation.version === version) {
      return true;
    }

    const updatedConversation: Conversation = {
      ...conversationWithContact.conversation,
      version,
      lastActivityAt: new Date(),
    };

    await this.repositories.conversationRepository.saveConversation(
      updatedConversation
    );
    this.inMemorySyncronization(
      updatedConversation,
      conversationWithContact.contact
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
    // prevent creating conversations with blocked addresses
    if (this.isAddressBlocked(recipientAddress)) {
      throw new Error(
        `Cannot create conversation with blocked address: ${recipientAddress}`
      );
    }

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

    // Derive deterministic aliases based on ECDH + HKDF
    const privateKey = this.getPrivateKey();
    const { myAlias, theirAlias } = deriveConversationAliases(
      privateKey,
      recipientAddress
    );

    console.log(
      "[Alias Derivation] Partner:",
      recipientAddress,
      "=> myAlias:",
      myAlias,
      "theirAlias:",
      theirAlias
    );

    const conversation: Conversation = {
      id: uuidv4(),
      myAlias,
      theirAlias,
      lastActivityAt: new Date(),
      status: "pending",
      initiatedByMe,
      contactId: contact.id,
      tenantId: this.repositories.tenantId,
      version: 2,
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
    // check if address is blocked before processing
    if (this.isAddressBlocked(payload.recipientAddress)) {
      throw new Error(
        `Cannot hydrate blocked address: ${payload.recipientAddress}`
      );
    }

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

    // Derive deterministic aliases for this conversation
    const privateKey = this.getPrivateKey();
    const { myAlias, theirAlias } = deriveConversationAliases(
      privateKey,
      payload.recipientAddress
    );

    console.log(
      "[hydrateFromSavedHandshake] Derived aliases for",
      payload.recipientAddress,
      "=> myAlias:",
      myAlias,
      "theirAlias:",
      theirAlias
    );

    const conversation = await this.repositories.conversationRepository
      .getConversationByContactId(contact.id)
      .catch(async (error) => {
        if (error instanceof DBNotFoundException) {
          const _conversation: Conversation = {
            id: uuidv4(),
            myAlias,
            theirAlias,
            lastActivityAt: new Date(payload.timestamp),
            status: "pending", // Will be activated when handshake is confirmed
            initiatedByMe: true,
            contactId: contact.id,
            tenantId: this.repositories.tenantId,
            version: 2,
          };

          await this.repositories.conversationRepository.saveConversation(
            _conversation
          );

          return _conversation;
        }
        throw error;
      });

    // Update with derived aliases (they should match if deterministic)
    conversation.myAlias = myAlias;
    conversation.theirAlias = theirAlias;
    conversation.lastActivityAt = new Date(payload.timestamp);

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

  /**
   * @deprecated Use deriveConversationAliases() instead - aliases are now deterministic
   * This method is kept for backward compatibility only
   */
  public generateUniqueAlias(): string {
    throw new Error(
      "generateUniqueAlias is deprecated - aliases are now deterministic. Use deriveConversationAliases() instead."
    );
  }

  private isValidKaspaAddress(address: string): boolean {
    // check for both mainnet and testnet address formats
    return (
      (address.startsWith("kaspa:") || address.startsWith("kaspatest:")) &&
      address.length > 10
    );
  }

  private isAddressBlocked(address: string): boolean {
    return useBlocklistStore.getState().isBlocked(address);
  }

  /**
   * assumption: conversation does not exist yet
   *  -> you should call this method only if you are sure that the conversation does not exist yet
   */
  private async processNewHandshake(
    payload: HandshakePayload,
    senderAddress: string
  ) {
    // ignore handshakes from blocked addresses
    if (this.isAddressBlocked(senderAddress)) {
      console.log(`Ignoring handshake from blocked address: ${senderAddress}`);
      return;
    }

    // Derive deterministic aliases based on sender's address
    const privateKey = this.getPrivateKey();
    const { myAlias, theirAlias } = deriveConversationAliases(
      privateKey,
      senderAddress
    );

    console.log(
      "[processNewHandshake] Derived aliases for",
      senderAddress,
      "=> myAlias:",
      myAlias,
      "theirAlias:",
      theirAlias
    );

    const status = payload.isResponse ? "active" : "pending";

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
      theirAlias,
      contactId,
      tenantId: this.repositories.tenantId,
      lastActivityAt: new Date(),
      status,
      initiatedByMe: false,
      version: 2,
    };

    await this.repositories.conversationRepository.saveConversation(
      conversation
    );

    this.inMemorySyncronization(conversation, newContact);

    if (payload.isResponse) {
      this.events?.onHandshakeCompleted?.(conversation, newContact);
    }
  }

  private validateHandshakePayload(payload: HandshakePayload) {
    // Version compatibility check
    if (
      payload.version &&
      payload.version > ConversationManagerService.PROTOCOL_VERSION
    ) {
      throw new Error("Unsupported protocol version");
    }

    // Aliases are no longer exchanged in handshake - they're derived deterministically
    // So no alias validation needed here
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
        // CRITICAL: Monitor myAlias (not theirAlias)
        // In deterministic system: I monitor myAlias, they send to theirAlias
        // Due to ECDH symmetry: their theirAlias === my myAlias
        monitored.push({
          alias: conversationAndContact.conversation.myAlias,
          address: conversationAndContact.contact.kaspaAddress,
        });
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
    // prevent creating offline handshakes with blocked addresses
    if (this.isAddressBlocked(partnerAddress)) {
      throw new Error(
        `Cannot create handshake with blocked address: ${partnerAddress}`
      );
    }

    // check if contact already exists - for offline handshakes, we should only create new contacts
    let contact: Contact;
    try {
      await this.repositories.contactRepository.getContactByKaspaAddress(
        partnerAddress
      );
      throw new Error(`Cannot create handshake. Contact already exists.`);
    } catch (error) {
      if (error instanceof DBNotFoundException) {
        // contact doesn't exist, create a new one
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
      version: 2,
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
