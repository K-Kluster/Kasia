import {
  ActiveConversation,
  Conversation,
  ConversationEvents,
  HandshakePayload,
  PendingConversation,
} from "src/types/messaging.types";
import { v4 as uuidv4 } from "uuid";

export class ConversationManager {
  private static readonly STORAGE_KEY_PREFIX = "encrypted_conversations";
  private static readonly ALIAS_LENGTH = 6; // 6 bytes = 12 hex characters
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
  ): Promise<{
    isNewHandshake: boolean;
    requiresResponse: boolean;
    conversation: Conversation;
  }> {
    try {
      const payload = this.parseHandshakePayload(payloadString);
      this.validateHandshakePayload(payload);

      // First try to find conversation by ID from payload
      let existingConv = this.conversations.get(payload.conversationId);

      // If not found by ID, try by address
      if (!existingConv) {
        const existingConvId = this.addressToConversation.get(senderAddress);
        if (existingConvId) {
          existingConv = this.conversations.get(existingConvId);
        }
      }

      if (existingConv) {
        // If this is a response to our handshake
        if (
          payload.isResponse &&
          existingConv.status === "pending" &&
          existingConv.initiatedByMe
        ) {
          // Update the conversation with their alias and set to active
          // Save and notify
          this.saveConversation({
            ...existingConv,
            status: "active",
            lastActivity: Date.now(),
            theirAlias: payload.alias,
          });
          this.events?.onHandshakeCompleted?.(existingConv);

          return {
            isNewHandshake: false,
            requiresResponse: false,
            conversation: existingConv,
          };
        }

        // If conversation is already active, check if this is a new handshake with different conversation ID
        if (existingConv.status === "active") {
          // Check if this is a new handshake from the same address (cache cleared scenario)
          if (
            !payload.isResponse &&
            payload.conversationId !== existingConv.conversationId
          ) {
            console.log(
              "Detected new handshake from existing contact - they may have cleared their cache"
            );
            console.log(
              "Existing conversation ID:",
              existingConv.conversationId
            );
            console.log("New conversation ID:", payload.conversationId);
            console.log(
              "Updating conversation with their new alias:",
              payload.alias
            );
            console.log("Our alias remains:", existingConv.myAlias);

            // Remove old alias mapping if it exists
            if (existingConv.theirAlias) {
              this.aliasToConversation.delete(existingConv.theirAlias);
            }

            // Update the existing conversation with new information
            existingConv.theirAlias = payload.alias;
            existingConv.lastActivity = Date.now();

            // Keep our conversation ID and alias, but update their alias
            // This maintains our conversation history while accepting their new identity

            // Save the updated conversation
            this.saveConversation(existingConv);

            // This requires a response to complete the re-handshake
            return {
              isNewHandshake: false,
              requiresResponse: true,
              conversation: existingConv,
            };
          }

          // Normal case - existing active conversation with same ID
          return {
            isNewHandshake: false,
            requiresResponse: false,
            conversation: existingConv,
          };
        }
      }

      // If this is a response but we didn't find a matching conversation, create a new one
      if (payload.isResponse) {
        console.log(
          "Handshake response received but no pending conversation found. Creating new conversation."
        );
        console.log(
          "Available conversations:",
          Array.from(this.conversations.keys())
        );
        console.log("Looking for conversation ID:", payload.conversationId);
        console.log("Looking for sender address:", senderAddress);

        // Create a new conversation for this response
        const newConversation: Conversation = {
          conversationId: payload.conversationId,
          myAlias: this.generateUniqueAlias(),
          theirAlias: payload.alias,
          kaspaAddress: senderAddress,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          status: "active",
          initiatedByMe: false,
        };

        this.saveConversation(newConversation);
        this.events?.onHandshakeCompleted?.(newConversation);

        return {
          isNewHandshake: false,
          requiresResponse: false,
          conversation: newConversation,
        };
      }

      // This is a new handshake initiation
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

  public updateConversation(conversation: Conversation) {
    // Validate the conversation
    if (!conversation.conversationId || !conversation.kaspaAddress) {
      throw new Error("Invalid conversation: missing required fields");
    }

    // Get the existing conversation
    const existing = this.conversations.get(conversation.conversationId);
    if (!existing) {
      throw new Error("Conversation not found");
    }

    // Update the conversation
    this.conversations.set(conversation.conversationId, {
      ...existing,
      ...conversation,
      lastActivity: Date.now(),
    });

    // If status changed to active, trigger the completion event
    if (existing.status === "pending" && conversation.status === "active") {
      this.events?.onHandshakeCompleted?.(conversation);
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
    const bytes = new Uint8Array(ConversationManager.ALIAS_LENGTH);
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

  private async processNewHandshake(
    payload: HandshakePayload,
    senderAddress: string
  ): Promise<{
    isNewHandshake: true;
    requiresResponse: true;
    conversation: Conversation;
  }> {
    // Check for duplicate alias collision
    if (this.aliasToConversation.has(payload.alias)) {
      throw new Error("Alias collision detected - handshake rejected");
    }

    // When receiving a handshake, we did not initiate it
    const conversation: Conversation = {
      conversationId: payload.conversationId, // Use the ID from the payload
      myAlias: this.generateUniqueAlias(),
      theirAlias: payload.alias,
      kaspaAddress: senderAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: "pending",
      initiatedByMe: false,
    };

    this.saveConversation(conversation);

    return {
      isNewHandshake: true,
      requiresResponse: true,
      conversation,
    };
  }

  private validateHandshakePayload(payload: HandshakePayload) {
    if (
      !payload.alias ||
      payload.alias.length !== ConversationManager.ALIAS_LENGTH * 2
    ) {
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

  /**
   * Validate a conversation object
   * @param conversation The conversation to validate
   * @returns boolean indicating if the conversation is valid
   */
  private isValidConversation(conversation: any): conversation is Conversation {
    return (
      typeof conversation === "object" &&
      typeof conversation.conversationId === "string" &&
      typeof conversation.myAlias === "string" &&
      (conversation.theirAlias === null ||
        typeof conversation.theirAlias === "string") &&
      typeof conversation.kaspaAddress === "string" &&
      ["pending", "active", "rejected"].includes(conversation.status) &&
      typeof conversation.createdAt === "number" &&
      typeof conversation.lastActivity === "number" &&
      typeof conversation.initiatedByMe === "boolean"
    );
  }
}
