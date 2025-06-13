export interface HandshakeState {
  conversationId: string;
  myAlias: string;
  theirAlias: string | null;
  senderAddress: string;
  kaspaAddress: string;
  status: 'pending' | 'active' | 'rejected';
  createdAt: number;
  lastActivity: number;
  initiatedByMe: boolean;
  handshakeTimeout?: number;
} 