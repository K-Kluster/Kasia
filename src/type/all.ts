export type Message = {
  content: string;
  payload: string;
  transactionId: string;
  senderAddress: string;
  recipientAddress: string;
  amount: number;
  timestamp: number;
};

export type Contact = {
  address: string;
  lastMessage: Message;
  messages: Message[];
};

export type NetworkType = "mainnet" | "testnet-10" | "testnet-11" | "devnet";
