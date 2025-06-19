import {
  RpcClient,
  Resolver,
  Encoding,
  IUtxosChanged,
  NetworkId,
  RpcEvent,
  RpcEventCallback,
  RpcEventMap,
  IVirtualChainChanged,
  IRawBlock,
  ITransaction,
  IBlockAdded,
} from "kaspa-wasm";
import { unknownErrorToErrorLike } from "./errors";
import { getNodesForNetwork, getApiEndpoint } from "../config/nodes";
import { NetworkType } from "../types/all";
import { BlockAddedData } from "../types/all";

// Helper function to decode payload to text
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
export async function fetchTransactionDetails(
  txId: string,
  networkId: NetworkType = "testnet-10"
) {
  const baseUrl = getApiEndpoint(networkId);
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

// Helper function to fetch address transactions
export async function fetchAddressTransactions(address: string) {
  try {
    // Remove the kaspa: or kaspatest: prefix and extract just the address part
    const cleanAddress = address.replace(/^(kaspa:|kaspatest:)/, "");

    // First get all UTXOs
    const apiEndpoints = [
      "https://api-tn10.kaspa.org",
      "https://api.kaspa.org",
      "https://api-testnet.kaspa.org",
    ];

    let utxoData = null;
    let successfulEndpoint = null;

    for (const baseUrl of apiEndpoints) {
      try {
        const response = await fetch(
          `${baseUrl}/addresses/${cleanAddress}/utxos`
        );
        if (response.ok) {
          utxoData = await response.json();
          successfulEndpoint = baseUrl;
          break;
        }
      } catch (error) {
        console.warn(`Error fetching UTXOs from ${baseUrl}:`, error);
        continue;
      }
    }

    if (!utxoData || !successfulEndpoint) {
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

    // Fetch full details for each transaction using the successful endpoint
    const transactions = {
      transactions: await Promise.all(
        Array.from(txIds).map(async (txId: string) => {
          try {
            const response = await fetch(
              `${successfulEndpoint}/transactions/${txId}`
            );
            if (!response.ok) {
              console.warn(`Failed to fetch transaction ${txId}`);
              return null;
            }
            return await response.json();
          } catch (error) {
            console.warn(`Error fetching transaction ${txId}:`, error);
            return null;
          }
        })
      ).then((txs) => txs.filter((tx) => tx !== null)),
    };

    return transactions;
  } catch (error) {
    console.error("Error fetching address transactions:", error);
    return { transactions: [] };
  }
}

// Add this helper function at the top level
function stringifyWithBigInt(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

// Create a simple client for API requests
export class KaspaClient {
  options: {
    debug: boolean;
    retryDelay: number;
    maxRetries: number;
  };

  rpc: RpcClient | null;
  networkId: NetworkType;
  connected: boolean;
  retryCount: number;

  utxoNotificationCallback?: (notification: IUtxosChanged) => unknown;
  utxoNotificationSubscribeAddresses: string[] = [];
  historyOfEmittedTxIdUtxoChanges: string[] = [];

  // Add block notification callback
  blockNotificationCallback?: (event: IBlockAdded) => void;

  constructor(networkId?: NetworkType) {
    this.options = {
      debug: true,
      retryDelay: 2000,
      maxRetries: 3,
    };

    this.rpc = null;
    this.networkId = networkId || "testnet-10";
    this.connected = false;
    this.retryCount = 0;

    // Debug log the network ID
    this.log(`KaspaClient initialized with network ID: ${this.networkId}`);
  }

  // Log helper function
  log(message: string, level: "log" | "warn" | "error" = "log") {
    // Only show errors and warnings
    if (this.options.debug && (level === "error" || level === "warn")) {
      console[level](`[KaspaClient] ${message}`);
    }
  }

  // Set the network ID
  setNetworkId(networkId: NetworkType) {
    this.networkId = networkId;
    this.log(`Network ID set to ${networkId}`);
    return this;
  }

  // Connect to a node using the resolver or custom node list
  async connect(): Promise<unknown> {
    if (!this.networkId) {
      throw new Error("Network ID must be set before connecting");
    }

    if (this.retryCount >= this.options.maxRetries) {
      throw new Error(
        `Failed to connect after ${this.options.maxRetries} attempts`
      );
    }

    try {
      this.log(
        `Initializing connection for network: "${
          this.networkId
        }" (type: ${typeof this.networkId})`
      );

      // Always try resolver first for all networks
      let resolverError: unknown;
      try {
        this.log("Using resolver to find an available node");
        this.rpc = new RpcClient({
          resolver: new Resolver(),
          networkId: this.networkId,
          encoding: Encoding.Borsh,
        });

        this.log("Resolver created, attempting connection...");
        await Promise.race([
          this.rpc.connect(),
          new Promise((_, reject) => {
            this.log("Setting resolver connection timeout for 20s");
            setTimeout(() => reject(new Error("Connection timeout")), 20000);
          }),
        ]);

        this.log("Initial connection successful, waiting for stability...");
        // Add a small delay after connection to ensure stability
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify connection is still active
        if (this.rpc && this.rpc.isConnected) {
          this.connected = true;
          this.log(`Connected via resolver to ${this.rpc.url}`);
          return this;
        } else {
          throw new Error("Connection lost after initial establishment");
        }
      } catch (error) {
        resolverError = error;
        this.log(
          `Resolver connection failed: ${unknownErrorToErrorLike(error)}`,
          "warn"
        );
        this.log("Falling back to custom nodes", "warn");
      }

      // If resolver fails, try custom nodes as fallback
      const nodes = getNodesForNetwork(this.networkId);
      if (nodes && nodes.length > 0) {
        const errors = [];
        for (const node of nodes) {
          try {
            this.log(
              `Trying to connect to node: ${node.description} (${node.url})`
            );

            this.rpc = new RpcClient({
              url: node.url,
              networkId: this.networkId,
              encoding: Encoding.Borsh,
            });

            await Promise.race([
              this.rpc.connect(),
              new Promise((_, reject) => {
                this.log(
                  `Setting ${node.description} connection timeout for 20s`
                );
                setTimeout(
                  () => reject(new Error("Connection timeout")),
                  20000
                );
              }),
            ]);

            // Add a small delay after connection to ensure stability
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify connection is still active
            if (this.rpc && this.rpc.isConnected) {
              this.connected = true;
              this.log(`Connected to ${node.url}`);
              return this;
            } else {
              throw new Error("Connection lost after initial establishment");
            }
          } catch (nodeError) {
            errors.push(
              `${node.description}: ${unknownErrorToErrorLike(nodeError)}`
            );
            this.log(
              `Connection failed to ${node.url}: ${unknownErrorToErrorLike(
                nodeError
              )}`,
              "warn"
            );

            // Clean up failed connection
            if (this.rpc) {
              try {
                await this.rpc.disconnect();
              } catch (disconnectError) {
                this.log(
                  `Error during disconnect: ${unknownErrorToErrorLike(
                    disconnectError
                  )}`,
                  "warn"
                );
              }
              this.rpc = null;
            }
          }
        }

        throw new Error(
          `All connection attempts failed:\nResolver: ${unknownErrorToErrorLike(
            resolverError
          )}\nCustom nodes:\n${errors.join("\n")}`
        );
      }

      throw new Error(`No available nodes for network ${this.networkId}`);
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

  async subscribeToUtxoChanges(
    addresses: string[],
    callback: (notification: IUtxosChanged) => unknown
  ) {
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSubscribe = async (): Promise<void> => {
      try {
        if (!this.rpc) {
          throw new Error("RPC client not initialized");
        }

        // Check connection and attempt reconnect if needed
        if (!this.rpc.isConnected) {
          this.log("Not connected, attempting to reconnect...");
          await this.connect();
        }

        if (this.utxoNotificationCallback) {
          this.rpc.removeEventListener(
            "utxos-changed",
            this.utxoNotificationCallback
          );
          this.rpc.unsubscribeUtxosChanged(
            this.utxoNotificationSubscribeAddresses
          );
          this.log("Removed existing UTXO change listener");
        }

        this.log(`Subscribing to UTXO changes for addresses: ${addresses}`);

        const boundCallback = callback.bind(this);

        const wrappedWithFilter = (notification: IUtxosChanged) => {
          const transactionIds = notification.data.added?.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (utxo: any) => utxo?.outpoint?.transactionId
          );

          const notEmittedTxIds = transactionIds.filter(
            (txId: string) =>
              this.historyOfEmittedTxIdUtxoChanges.findIndex(
                (item) => item === txId
              ) === -1
          );

          if (notEmittedTxIds.length > 0) {
            this.log(
              `Emitting UTXO change notification for txids: ${notEmittedTxIds}`
            );
            this.historyOfEmittedTxIdUtxoChanges.push(...notEmittedTxIds);

            boundCallback(notification);
          }
        };

        this.utxoNotificationCallback = wrappedWithFilter.bind(this);
        this.utxoNotificationSubscribeAddresses = addresses;

        this.rpc.addEventListener(
          "utxos-changed",
          this.utxoNotificationCallback
        );
        await this.rpc.subscribeUtxosChanged(
          this.utxoNotificationSubscribeAddresses
        );

        this.log("Successfully subscribed to UTXO changes");
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          this.log(
            `Retry ${retryCount}/${maxRetries} for UTXO subscription after error: ${unknownErrorToErrorLike(
              error
            )}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          return attemptSubscribe();
        }
        this.log(
          `Error subscribing to UTXO changes: ${unknownErrorToErrorLike(
            error
          )}`,
          "error"
        );
        throw error;
      }
    };

    return attemptSubscribe();
  }

  async subscribeToBlockAdded(callback: (event: IBlockAdded) => void) {
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSubscribe = async (): Promise<void> => {
      try {
        if (!this.rpc) {
          throw new Error("RPC client not initialized");
        }

        // Check connection and attempt reconnect if needed
        if (!this.rpc.isConnected) {
          this.log("Not connected, attempting to reconnect...");
          await this.connect();
        }

        if (this.blockNotificationCallback) {
          this.rpc.removeEventListener(
            "block-added",
            this.blockNotificationCallback
          );
          await this.rpc.unsubscribeBlockAdded();
          this.log("Removed existing block notification listener");
        }

        // Create a wrapped callback that handles BigInt serialization
        const wrappedCallback = (event: IBlockAdded) => {
          try {
            // Log the event using BigInt-safe stringifier
            this.log(
              `Received block-added event: ${stringifyWithBigInt(event)}`
            );

            // Process transactions if they exist
            const transactions = event?.transactions || [];
            this.log(`Block contains ${transactions.length} transactions`);

            // Call the original callback
            callback(event);
          } catch (error) {
            this.log(`Error in block notification callback: ${error}`, "error");
          }
        };

        // Subscribe to block-added events
        this.blockNotificationCallback = wrappedCallback;
        await this.rpc.subscribeBlockAdded();
        this.rpc.addEventListener("block-added", wrappedCallback);
        this.log("Successfully subscribed to block-added events");
      } catch (error) {
        this.log(`Error subscribing to block-added events: ${error}`, "error");
        if (retryCount < maxRetries) {
          retryCount++;
          this.log(
            `Retrying subscription (attempt ${retryCount} of ${maxRetries})...`
          );
          await attemptSubscribe();
        } else {
          throw error;
        }
      }
    };

    await attemptSubscribe();
  }
}
