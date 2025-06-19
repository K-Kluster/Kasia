export interface HandshakeState {
  conversationId: string;
  myAlias: string;
  theirAlias: string | null;
  senderAddress: string;
  kaspaAddress: string;
  status: "pending" | "active" | "rejected";
  createdAt: number;
  lastActivity: number;
  initiatedByMe: boolean;
}

export type BaseConversation = {
  conversationId: string;
  myAlias: string;
  theirAlias: string | null; // null if handshake incomplete
  kaspaAddress: string;
  createdAt: number;
  lastActivity: number;

  initiatedByMe: boolean; // track who initiated the handshake
};

export type ActiveConversation = BaseConversation & {
  status: "active";
};

export type RejectedConversation = BaseConversation & {
  status: "rejected";
};

export type PendingConversation = BaseConversation & {
  status: "pending";
};

export type Conversation =
  | ActiveConversation
  | RejectedConversation
  | PendingConversation;

export interface HandshakePayload {
  type: "handshake";
  alias: string;
  theirAlias?: string; // Used in response to confirm both aliases
  timestamp: number;
  conversationId: string;
  version: number; // for future protocol upgrades
  recipientAddress?: string; // Only used for initial handshake
  sendToRecipient?: boolean; // Flag to indicate if message should be sent to recipient
  isResponse?: boolean; // Flag to indicate this is a response
}

export interface ConversationEvents {
  onHandshakeInitiated: (conversation: Conversation) => void;
  onHandshakeCompleted: (conversation: Conversation) => void;
  onHandshakeExpired: (conversation: Conversation) => void;
  onError: (error: unknown) => void;
}
