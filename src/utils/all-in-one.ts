import { RpcClient, Resolver, Encoding } from "kaspa-wasm";
import { unknownErrorToErrorLike } from "./errors";

// Helper function to decode hex payload to text
export function decodePayload(hex: string) {
  try {
    if (!hex) return "No payload";
    // Convert hex to text
    const text = hex
      .match(/.{1,2}/g)
      ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
      .join("");
    // Check if the text is printable ASCII
    if (/^[\x20-\x7E]*$/.test(text ?? "N/A")) {
      return text;
    }
    return `Hex: ${hex}`;
  } catch (e) {
    console.error("Error decoding payload:", e);
    return `Hex: ${hex}`;
  }
}

// Helper function to fetch transaction details
export async function fetchTransactionDetails(txId: string) {
  const baseUrl = "https://api-tn10.kaspa.org";
  try {
    // First get the transaction to get its accepting block hash and blue score
    const txResponse = await fetch(
      `${baseUrl}/transactions/${txId}?inputs=true&outputs=true&resolve_previous_outpoints=full`
    );
    if (!txResponse.ok) {
      console.log(`Transaction ${txId} not found`);
      return null;
    }

    const txData = await txResponse.json();
    if (!txData.accepting_block_hash || !txData.accepting_block_blue_score) {
      console.log(`No block data found for transaction ${txId}`);
      return null;
    }

    // Get the block details using the blue score
    const blockResponse = await fetch(
      `${baseUrl}/blocks-from-bluescore?blueScore=${txData.accepting_block_blue_score}&includeTransactions=true`
    );
    if (!blockResponse.ok) {
      console.log(
        `Block with blue score ${txData.accepting_block_blue_score} not found`
      );
      return null;
    }

    const blockData = await blockResponse.json();
    if (!blockData[0]?.header?.daaScore) {
      console.log(
        `No DAA score found for block ${txData.accepting_block_hash}`
      );
      return null;
    }

    // Store the DAA score for later use
    const daaScore = blockData[0].header.daaScore;
    console.log(`Found DAA score ${daaScore} for transaction ${txId}`);

    // Try to fetch from kasplex.org immediately
    const kasplexData = await fetchKasplexData(daaScore);

    return kasplexData;
  } catch (error) {
    console.warn(`Error fetching transaction details:`, error);
    return null;
  }
}

// Helper function to fetch data from kasplex.org
export async function fetchKasplexData(daaScore: string) {
  try {
    const kasplexResponse = await fetch(
      `https://tn10api.kasplex.org/v1/archive/vspc/${daaScore}`
    );

    // Handle 403 Forbidden response gracefully
    if (kasplexResponse.status === 403) {
      console.log(
        `Block with DAA score ${daaScore} is not yet available on kasplex.org. Waiting for block to be processed...`
      );
      return null;
    }

    // Handle other error responses
    if (!kasplexResponse.ok) {
      console.warn(
        `Error fetching from kasplex.org: ${kasplexResponse.status} ${kasplexResponse.statusText}`
      );
      return null;
    }

    const kasplexData = await kasplexResponse.json();
    if (
      kasplexData.message === "successful" &&
      kasplexData.result &&
      kasplexData.result[0].txList
    ) {
      return kasplexData;
    }
    return null;
  } catch (error) {
    console.warn(`Error fetching from kasplex.org:`, error);
    return null;
  }
}

// @QUESTION(): this wasn't called, should we remove it ?
//   // Function to update the UI with new transaction data
//   function updateTransactionUI(txId, txData) {
//     // Find the transaction element in the UI
//     const txElement = document.querySelector(`[data-tx-id="${txId}"]`);
//     if (txElement) {
//       // Update the UI with the new data
//       // This is just a placeholder - you'll need to implement the actual UI update logic
//       console.log(`Updating UI for transaction ${txId} with new data:`, txData);
//     }
//   }

// Helper function to fetch address transactions
export async function fetchAddressTransactions(address: string) {
  try {
    // Remove the kaspatest: prefix and extract just the address part
    const cleanAddress = address.replace("kaspatest:", "");

    // First get all UTXOs
    const apiEndpoints = [
      "https://api-tn10.kaspa.org",
      "https://api.kaspa.org",
      "https://api-testnet.kaspa.org",
    ];

    let utxoData = null;
    for (const baseUrl of apiEndpoints) {
      try {
        const response = await fetch(
          `${baseUrl}/info/utxos/address/${cleanAddress}`
        );
        if (response.ok) {
          utxoData = await response.json();
          break;
        }
      } catch (error) {
        console.warn(`Error fetching UTXOs from ${baseUrl}:`, error);
        continue;
      }
    }

    if (!utxoData) {
      throw new Error("Failed to fetch UTXOs from all endpoints");
    }

    // Get all transaction IDs from UTXOs
    const txIds = new Set<string>();
    if (utxoData.utxos) {
      utxoData.utxos.forEach(
        (utxo: {
          transactionId: string;
          outpoint?: { transactionId: string };
        }) => {
          if (utxo.transactionId) txIds.add(utxo.transactionId);
          // Also add the outpoint transaction ID if it exists
          if (utxo.outpoint && utxo.outpoint.transactionId) {
            txIds.add(utxo.outpoint.transactionId);
          }
        }
      );
    }

    // Fetch full details for each transaction
    const transactions = {
      transactions: await Promise.all(
        Array.from(txIds).map(async (txId: string) => {
          const txDetails = await fetchTransactionDetails(txId);
          return txDetails;
        })
      ).then((txs) => txs.filter((tx) => tx !== null)),
    };

    return transactions;
  } catch (error) {
    console.error("Error fetching address transactions:", error);
    return { transactions: [] };
  }
}

// Create a simple client for API requests
export class KaspaClient {
  options: {
    debug: boolean;
    retryDelay: number;
    maxRetries: number;
  };

  rpc: RpcClient | null;
  networkId: string;
  connected: boolean;
  retryCount: number;

  constructor(options = {}) {
    this.options = {
      debug: true,
      retryDelay: 2000,
      maxRetries: 3,
      ...options,
    };

    this.rpc = null;
    this.networkId = "mainnet";
    this.connected = false;
    this.retryCount = 0;
  }

  // Log helper function
  log(message: string, level = "log") {
    if (this.options.debug) {
      // @TODO: use a proper logging method
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      console[level](`[KaspaClient] ${message}`);
    }
  }

  // Set the network ID
  setNetworkId(networkId: string) {
    this.networkId = networkId;
    this.log(`Network ID set to ${networkId}`);
    return this;
  }

  // Connect to a node using the resolver
  async connect(): Promise<unknown> {
    if (this.retryCount >= this.options.maxRetries) {
      throw new Error(
        `Failed to connect after ${this.options.maxRetries} attempts`
      );
    }

    try {
      this.log(`Initializing connection for network: ${this.networkId}`);

      // Create RPC client with proper configuration
      this.rpc = new RpcClient({
        resolver: new Resolver(),
        networkId: this.networkId,
        encoding: Encoding.Borsh,
      });

      // Connect to the network
      await this.rpc.connect();
      this.connected = true;
      this.log(`Connected to ${this.rpc.url}`);

      return this;
    } catch (error) {
      this.log(
        `Connection attempt failed: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      this.retryCount++;

      if (this.retryCount < this.options.maxRetries) {
        this.log(`Retrying in ${this.options.retryDelay}ms...`);
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.retryDelay)
        );
        return this.connect();
      }

      throw error;
    }
  }

  // Disconnect from the node
  async disconnect() {
    if (this.rpc && this.connected) {
      await this.rpc.disconnect();
      this.connected = false;
      this.log("Disconnected from node");
    }
  }

  // Subscribe to UTXO changes
  // @TODO(tech): type notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribeToUtxoChanges(addresses: string[], callback: (notification: any) => unknown) {
    if (!this.rpc || !this.connected) {
      throw new Error("Not connected to network");
    }

    this.log(`Subscribing to UTXO changes for addresses: ${addresses}`);

    try {
      // Use the correct RPC method for UTXO subscription

      // @QUESTION: does this works? i had to lie to the type system
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.rpc.subscribeUtxosChanged(addresses, (notification) => {
        this.log("UTXO change detected:", notification);
        callback(notification);
      });

      this.log("Successfully subscribed to UTXO changes");
    } catch (error) {
      this.log(
        `Error subscribing to UTXO changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      throw error;
    }
  }
}
