import { useState, useEffect, useCallback, useRef } from "react";
import { KaspaClient } from "../utils/all-in-one";
import type { NetworkType } from "../types/all";

export interface UseKaspaClientOptions {
  onConnect?: (client: KaspaClient) => void;
  onError?: (error: Error) => void;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
}

export function useKaspaClient(
  network: NetworkType,
  {
    onConnect,
    onError,
    maxReconnectAttempts = 3,
    reconnectDelayMs = 1000,
  }: UseKaspaClientOptions = {}
): {
  client: KaspaClient | null;
  status: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
} {
  const [client, setClient] = useState<KaspaClient | null>(null);
  const [status, setStatus] = useState("Waiting for interaction");
  const [isConnected, setIsConnected] = useState(false);
  const inProgress = useRef(false);
  const active = useRef(true);

  const connect = useCallback(async (): Promise<void> => {
    // Skip if already attempting connection
    if (inProgress.current) {
      console.log("Connection attempt already in progress, skipping");
      return;
    }
    inProgress.current = true;

    setStatus("Connecting...");
    setIsConnected(false);

    let attempts = 0;
    while (attempts < maxReconnectAttempts && active.current) {
      attempts++;

      // Disconnect existing client if any
      if (client?.connected) {
        console.log("Disconnecting existing client");
        await client.disconnect();
        setClient(null);
      }

      console.log(
        `Attempting to connect to ${network} (type: ${typeof network})`
      );

      try {
        const c = new KaspaClient(network);

        // Try to connect
        console.log("Calling connect() on KaspaClient...");
        await c.connect();
        console.log("Connect() call completed");

        if (c.connected) {
          console.log(`Successfully connected to ${network}`);
          setClient(c);
          setIsConnected(true);
          setStatus(`Connected to ${network}`);
          onConnect?.(c);
          break;
        }

        // Failed to connect
        console.log(`Failed to connect to ${network}`);
        setIsConnected(false);
        setStatus("Connection Failed");
        onError?.(new Error("Connection failed"));
      } catch (err) {
        // Console.error during connect
        console.error("Failed to connect:", err);
        const e = err as Error;
        setIsConnected(false);
        setStatus(
          attempts < maxReconnectAttempts
            ? `Reconnecting (${attempts}/${maxReconnectAttempts})...`
            : "Failed to establish stable connection after multiple attempts"
        );
        onError?.(e);
      }

      // Delay before next attempt
      if (attempts < maxReconnectAttempts) {
        await new Promise((r) => setTimeout(r, reconnectDelayMs));
      }
    }

    inProgress.current = false;
  }, [
    network,
    client,
    maxReconnectAttempts,
    reconnectDelayMs,
    onConnect,
    onError,
  ]);

  const disconnect = useCallback((): void => {
    active.current = false;

    // Disconnect if connected
    if (client?.connected) {
      console.log("Disconnecting client on cleanup");
      client.disconnect();
    }

    setClient(null);
    setIsConnected(false);
    setStatus("Waiting for interaction");
  }, [client]);

  useEffect(() => {
    inProgress.current = false;
    active.current = true;
    void connect();

    return () => {
      active.current = false;
      inProgress.current = false;
      disconnect();
    };
  }, [network]);
  
  return { client, status, isConnected, connect, disconnect };
}
