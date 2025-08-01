import {
  getHandshakesByReceiver,
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
}
