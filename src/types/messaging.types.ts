import { Conversation } from "../store/repository/conversation.repository";

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

export interface PaymentPayload {
  type: "payment";
  message: string;
  amount: number; // Amount in KAS
  timestamp: number;
  version: number;
}

export interface ConversationEvents {
  onHandshakeInitiated: (conversation: Conversation) => void;
  onHandshakeCompleted: (conversation: Conversation) => void;
  onHandshakeExpired: (conversation: Conversation) => void;
  onError: (error: unknown) => void;
}
