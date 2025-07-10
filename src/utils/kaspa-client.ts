import {
  RpcClient,
  IUtxosChanged,
  IBlockAdded,
  Encoding,
  Resolver,
} from "kaspa-wasm";
import { unknownErrorToErrorLike } from "./errors";
import { NetworkType } from "../types/all";

export interface KaspaClientArgs {
  networkId?: NetworkType;
  nodeUrl?: string;
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
  nodeUrl?: string;
  connected: boolean;
  retryCount: number;

  utxoNotificationCallback?: (notification: IUtxosChanged) => unknown;
  utxoNotificationSubscribeAddresses: string[] = [];
  historyOfEmittedTxIdUtxoChanges: string[] = [];

  // Add block notification callback
  blockNotificationCallback?: (event: IBlockAdded) => void;

  constructor(args?: KaspaClientArgs) {
    this.options = {
      debug: true,
      retryDelay: 2000,
      maxRetries: 3,
    };

    this.rpc = null;
    this.networkId = args?.networkId || "testnet-10";
    this.nodeUrl = args?.nodeUrl;
    this.connected = false;
    this.retryCount = 0;

    // Debug log the network ID
    console.log(`KaspaClient initialized with network ID: ${this.networkId}`);
  }

  // Set the network ID
  setNetworkId(networkId: NetworkType) {
    this.networkId = networkId;
    console.log(`Network ID set to ${networkId}`);
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
      console.log(
        `Initializing connection for network: "${
          this.networkId
        }" (type: ${typeof this.networkId})`
      );

      // Always try resolver first for all networks
      try {
        console.log("Using resolver to find an available node");
        this.rpc = new RpcClient({
          resolver: new Resolver(),
          networkId: this.networkId,
          encoding: Encoding.Borsh,
          url: this.nodeUrl,
        });

        console.log("Resolver created, attempting connection...");
        await Promise.race([
          this.rpc.connect({
            blockAsyncConnect: true,
            retryInterval: 0,
            timeoutDuration: 10000,
          }),
          new Promise((_, reject) => {
            console.log("Setting resolver connection timeout for 20s");
            setTimeout(() => reject(new Error("Connection timeout")), 20000);
          }),
        ]);

        // Verify connection is still active
        if (this.rpc && this.rpc.isConnected) {
          this.connected = true;
          console.log(`Connected via resolver to ${this.rpc.url}`);
          return this;
        } else {
          throw new Error("Connection lost after initial establishment");
        }
      } catch (error) {
        console.log(
          `Resolver connection failed: ${unknownErrorToErrorLike(error)}`
        );
      }

      throw new Error(
        `Failed to connect to ${this.rpc?.url} on network ${this.networkId}`
      );
    } catch (error) {
      console.log(
        `Connection attempt failed: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      this.retryCount++;

      if (this.retryCount < this.options.maxRetries) {
        console.log(`Retrying in ${this.options.retryDelay}ms...`);
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
      console.log("Disconnected from node");
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
          console.log("Not connected, attempting to reconnect...");
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
          console.log("Removed existing UTXO change listener");
        }

        console.log(`Subscribing to UTXO changes for addresses: ${addresses}`);

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
            console.log(
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

        console.log("Successfully subscribed to UTXO changes");
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `Retry ${retryCount}/${maxRetries} for UTXO subscription after error: ${unknownErrorToErrorLike(
              error
            )}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          return attemptSubscribe();
        }
        console.log(
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
          console.log("Not connected, attempting to reconnect...");
          await this.connect();
        }

        if (this.blockNotificationCallback) {
          this.rpc.removeEventListener(
            "block-added",
            this.blockNotificationCallback
          );
          await this.rpc.unsubscribeBlockAdded();
          console.log("Removed existing block notification listener");
        }

        // Create a wrapped callback that handles BigInt serialization
        const wrappedCallback = (event: IBlockAdded) => {
          try {
            // Log the event using BigInt-safe stringifier
            // console.log(
            //   `Received block-added event: ${stringifyWithBigInt(event)}`
            // );

            // Process transactions if they exist
            // const transactions = event?.transactions || [];
            // console.log(`Block contains ${transactions.length} transactions`);

            // Call the original callback
            callback(event);
          } catch (error) {
            console.log(
              `Error in block notification callback: ${error}`,
              "error"
            );
          }
        };

        // Subscribe to block-added events
        this.blockNotificationCallback = wrappedCallback;
        await this.rpc.subscribeBlockAdded();
        this.rpc.addEventListener("block-added", wrappedCallback);
        console.log("Successfully subscribed to block-added events");
      } catch (error) {
        console.log(
          `Error subscribing to block-added events: ${error}`,
          "error"
        );
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(
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
