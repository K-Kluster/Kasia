import {
  ActiveConversation,
  Conversation,
  ConversationEvents,
  HandshakePayload,
  PendingConversation,
} from "src/types/messaging.types";
import { v4 as uuidv4 } from "uuid";
import { ALIAS_LENGTH } from "../config/constants";
import { isAlias } from "./alias-validator";

export class ConversationManager {
  private static readonly STORAGE_KEY_PREFIX = "encrypted_conversations";
  private static readonly PROTOCOL_VERSION = 1;

  private conversations: Map<string, Conversation> = new Map();
  private aliasToConversation: Map<string, string> = new Map(); // alias -> conversationId
  private addressToConversation: Map<string, string> = new Map(); // kaspaAddress -> conversationId

  constructor(
    private currentAddress: string,
    private events?: Partial<ConversationEvents>
  ) {
    this.loadConversations();
  }

  private get storageKey(): string {
    return `${ConversationManager.STORAGE_KEY_PREFIX}_${this.currentAddress}`;
  }

  private saveToStorage() {
    try {
      const data = Array.from(this.conversations.values());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save conversations to storage:", error);
    }
  }

  private loadConversations() {
    try {
      // Clear existing data first
      this.conversations.clear();
      this.aliasToConversation.clear();
      this.addressToConversation.clear();

      // Load conversations for current wallet
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const conversations = JSON.parse(data) as Conversation[];
        conversations.forEach((conv) => {
          // Only load conversations that belong to the current wallet address
          if (
            conv.kaspaAddress &&
            this.isValidKaspaAddress(conv.kaspaAddress)
          ) {
            this.conversations.set(conv.conversationId, conv);
            this.addressToConversation.set(
              conv.kaspaAddress,
              conv.conversationId
            );
            this.aliasToConversation.set(conv.myAlias, conv.conversationId);
            if (conv.theirAlias) {
              this.aliasToConversation.set(
                conv.theirAlias,
                conv.conversationId
              );
            }
          }
        });
      }
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
  }> {
    try {
      // Validate recipient address format
      if (!this.isValidKaspaAddress(recipientAddress)) {
        throw new Error("Invalid Kaspa address format");
      }

      // Check if we already have an active conversation
      const existingConvId = this.addressToConversation.get(recipientAddress);
      if (existingConvId) {
        const conv = this.conversations.get(existingConvId);
        if (conv && conv.status === "active") {
          throw new Error(
            "Active conversation already exists with this address"
          );
        }
        // Keep the first alias - reuse existing pending conversation
        if (conv && conv.status === "pending") {
          // Create handshake payload with the existing alias (keeps first alias)
          const handshakePayload: HandshakePayload = {
            type: "handshake",
            alias: conv.myAlias, // Keep the original alias
            timestamp: Date.now(),
            conversationId: conv.conversationId,
            version: ConversationManager.PROTOCOL_VERSION,
            recipientAddress: recipientAddress,
            sendToRecipient: true,
          };

          // Format for blockchain transaction
          const payload = `ciph_msg:${
            ConversationManager.PROTOCOL_VERSION
          }:handshake:${JSON.stringify(handshakePayload)}`;

          // Update last activity to show it's still active
          conv.lastActivity = Date.now();
          this.saveConversation(conv);

          // Note: Not triggering onHandshakeInitiated again since it's a retry
          return { payload, conversation: conv };
        }
      }

      // Generate new conversation with unique alias (only for truly new handshakes)
      const conversation = this.createNewConversation(recipientAddress, true);

      // Create handshake payload - initial handshake is sent directly to recipient
      const handshakePayload: HandshakePayload = {
        type: "handshake",
        alias: conversation.myAlias,
        timestamp: Date.now(),
        conversationId: conversation.conversationId,
        version: ConversationManager.PROTOCOL_VERSION,
        recipientAddress: recipientAddress,
        sendToRecipient: true, // Flag to indicate this should be sent to recipient
      };

      // Format for blockchain transaction
      const payload = `ciph_msg:${
        ConversationManager.PROTOCOL_VERSION
      }:handshake:${JSON.stringify(handshakePayload)}`;

      this.events?.onHandshakeInitiated?.(conversation);

      return { payload, conversation };
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
      const existingConversationById = this.conversations.get(
        payload.conversationId
      );

      if (existingConversationById) {
        // ------- this is a replay of a message we already handled -------
        // keep the guard so we don't downgrade on refresh
        if (
          payload.isResponse &&
          existingConversationById.status === "pending"
        ) {
          // Promote the existing pending conversation to active *in-place* so any listeners that hold the original object see the change immediately.
          (existingConversationById as unknown as ActiveConversation).status =
            "active";
          this.saveConversation(existingConversationById);
          this.events?.onHandshakeCompleted?.(existingConversationById);
        }
        return; // ⬅ nothing else to do
      }

      // STEP 2 – we didn't find that ID, but do we know the address?
      const existingByAddress =
        this.addressToConversation.get(senderAddress) &&
        this.conversations.get(this.addressToConversation.get(senderAddress)!);

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
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found for handshake response");
    }

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
        lastActivity: Date.now(),
      };
      this.saveConversation(activatedConversation);
      this.events?.onHandshakeCompleted?.(activatedConversation);
    } else {
      // For active conversations, just update last activity
      conversation.lastActivity = Date.now();
      this.saveConversation(conversation);
    }

    const responsePayload: HandshakePayload = {
      type: "handshake",
      alias: conversation.myAlias,
      theirAlias: conversation.theirAlias, // Include their alias in response
      timestamp: Date.now(),
      conversationId: conversation.conversationId, // Use our conversation ID
      version: ConversationManager.PROTOCOL_VERSION,
      recipientAddress: conversation.kaspaAddress, // Include their address
      sendToRecipient: false, // Set to false to use standard encryption
      isResponse: true,
    };

    return `ciph_msg:${
      ConversationManager.PROTOCOL_VERSION
    }:handshake:${JSON.stringify(responsePayload)}`;
  }

  public getConversationByAlias(alias: string): Conversation | null {
    const convId = this.aliasToConversation.get(alias);
    return convId ? this.conversations.get(convId) || null : null;
  }

  public getConversationByAddress(address: string): Conversation | null {
    const convId = this.addressToConversation.get(address);
    return convId ? this.conversations.get(convId) || null : null;
  }

  public getActiveConversations(): Conversation[] {
    return Array.from(this.conversations.values()).filter(
      (conv) => conv.status === "active"
    );
  }

  public getPendingConversations(): PendingConversation[] {
    return Array.from(this.conversations.values()).filter(
      (conv) => conv.status === "pending"
    );
  }

  public updateLastActivity(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastActivity = Date.now();
      this.saveConversation(conversation);
    }
  }

  public removeConversation(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    this.conversations.delete(conversationId);
    this.addressToConversation.delete(conversation.kaspaAddress);
    this.aliasToConversation.delete(conversation.myAlias);
    if (conversation.theirAlias) {
      this.aliasToConversation.delete(conversation.theirAlias);
    }
    this.saveToStorage();
    return true;
  }

  public updateConversation(
    conversation: Pick<Conversation, "conversationId"> & Partial<Conversation>
  ) {
    // Validate the conversation
    if (!conversation.conversationId) {
      throw new Error("Invalid conversation: missing required fields");
    }

    // Get the existing conversation
    const existing = this.conversations.get(conversation.conversationId);
    if (!existing) {
      throw new Error("Conversation not found");
    }

    // Update the conversation
    const updatedConversation = {
      ...existing,
      ...conversation,
      lastActivity: Date.now(),
    };
    this.conversations.set(conversation.conversationId, updatedConversation);

    // If status changed to active, trigger the completion event
    if (existing.status === "pending" && conversation.status === "active") {
      this.events?.onHandshakeCompleted?.(updatedConversation);
    }

    // Update mappings
    if (conversation.kaspaAddress) {
      this.addressToConversation.set(
        conversation.kaspaAddress,
        conversation.conversationId
      );
    }

    if (conversation.myAlias) {
      this.aliasToConversation.set(
        conversation.myAlias,
        conversation.conversationId
      );
    }

    if (conversation.theirAlias) {
      this.aliasToConversation.set(
        conversation.theirAlias,
        conversation.conversationId
      );
    }

    // Save to storage
    this.saveToStorage();
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
    } catch (error) {
      throw new Error("Invalid handshake JSON payload");
    }
  }

  private createNewConversation(
    recipientAddress: string,
    initiatedByMe: boolean
  ): Conversation {
    const conversation: Conversation = {
      conversationId: uuidv4(),
      myAlias: this.generateUniqueAlias(),
      theirAlias: null,
      kaspaAddress: recipientAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: "pending",
      initiatedByMe,
    };

    this.saveConversation(conversation);
    return conversation;
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

    const conversation: Conversation = {
      conversationId: payload.conversationId,
      myAlias,
      theirAlias: payload.alias,
      kaspaAddress: senderAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status,
      initiatedByMe: false,
    };

    this.saveConversation(conversation);

    if (isMyNewAliasValid) {
      this.events?.onHandshakeCompleted?.(conversation);
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

  private saveConversation(conversation: Conversation) {
    this.conversations.set(conversation.conversationId, conversation);
    this.addressToConversation.set(
      conversation.kaspaAddress,
      conversation.conversationId
    );
    this.aliasToConversation.set(
      conversation.myAlias,
      conversation.conversationId
    );
    if (conversation.theirAlias) {
      this.aliasToConversation.set(
        conversation.theirAlias,
        conversation.conversationId
      );
    }
    this.saveToStorage();
  }

  public getMonitoredConversations(): { alias: string; address: string }[] {
    const monitored: { alias: string; address: string }[] = [];

    Array.from(this.conversations.values())
      .filter((conv) => conv.status === "active")
      .forEach((conv) => {
        // Monitor our own alias
        monitored.push({
          alias: conv.myAlias,
          address: conv.kaspaAddress,
        });

        // Also monitor their alias if available
        if (conv.theirAlias) {
          monitored.push({
            alias: conv.theirAlias,
            address: conv.kaspaAddress,
          });
        }
      });

    return monitored;
  }

  /**
   * Restore a conversation from a backup
   * @param conversation The conversation to restore
   */
  restoreConversation(conversation: Conversation): void {
    // Validate conversation object
    if (!this.isValidConversation(conversation)) {
      console.error("Invalid conversation object:", conversation);
      return;
    }

    // Check if conversation already exists
    const existingConversation = this.conversations.get(
      conversation.conversationId
    );
    if (existingConversation) {
      // Update existing conversation
      this.conversations.set(conversation.conversationId, {
        ...existingConversation,
        ...conversation,
        lastActivity: Date.now(),
      });
    } else {
      // Add new conversation
      this.conversations.set(conversation.conversationId, conversation);
    }

    // Update mappings
    this.addressToConversation.set(
      conversation.kaspaAddress,
      conversation.conversationId
    );
    this.aliasToConversation.set(
      conversation.myAlias,
      conversation.conversationId
    );
    if (conversation.theirAlias) {
      this.aliasToConversation.set(
        conversation.theirAlias,
        conversation.conversationId
      );
    }

    // Save to storage
    this.saveToStorage();
  }

  private identifyConversationByConversationIdOrAddress(
    conversationId: string,
    senderAddress: string
  ): Conversation | null {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      return conversation;
    }

    const conversationIdByAddress =
      this.addressToConversation.get(senderAddress);
    if (conversationIdByAddress) {
      return this.conversations.get(conversationIdByAddress) || null;
    }

    return null;
  }

  /**
   * Validate a conversation object
   * @param conversation The conversation to validate
   * @returns boolean indicating if the conversation is valid
   */
  private isValidConversation(
    conversation: unknown
  ): conversation is Conversation {
    if (typeof conversation !== "object" || conversation === null) {
      return false;
    }

    const conv = conversation as Partial<Conversation>;

    return (
      typeof conv.conversationId === "string" &&
      typeof conv.myAlias === "string" &&
      (conv.theirAlias === null || typeof conv.theirAlias === "string") &&
      typeof conv.kaspaAddress === "string" &&
      ["pending", "active", "rejected"].includes(
        conv.status as Conversation["status"]
      ) &&
      typeof conv.createdAt === "number" &&
      typeof conv.lastActivity === "number" &&
      typeof conv.initiatedByMe === "boolean"
    );
  }
}
