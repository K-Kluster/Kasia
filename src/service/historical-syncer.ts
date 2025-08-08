import {
  getContextualMessagesBySender,
  getHandshakesByReceiver,
  getPaymentsBySender,
  HandshakeResponse,
} from "./indexer/generated";

/**
 * Handles historical events
 */
export class HistoricalSyncer {
  constructor(readonly address: string) {}

  /**
   * Emits `initialLoadCompleted` when done
   */
  async initialLoad(): Promise<HandshakeResponse[]> {
    // fetch all historical handhskaes for this address
    const handshakeResponses = await getHandshakesByReceiver({
      query: { address: this.address },
    });

    if (handshakeResponses.error) {
      console.error("Error fetching handshakes", handshakeResponses.error);
      return [];
    }

    return handshakeResponses.data;
  }

  async fetchHistoricalMessagesToAddress(from: string, alias: string) {
    const messages = await getContextualMessagesBySender({
      query: {
        address: from,
        // encode alias as hex string using text encoder
        alias: new TextEncoder()
          .encode(alias)
          .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), ""),
      },
    });

    if (messages.error) {
      console.error("Error fetching messages", messages.error);
      return [];
    }

    return messages.data;
  }

  async fetchHistoricalPaymentsFromAddress(from: string) {
    const payments = await getPaymentsBySender({
      query: {
        address: from,
      },
    });

    if (payments.error) {
      console.error("Error fetching payments", payments.error);
      return [];
    }

    return payments.data;
  }
}
