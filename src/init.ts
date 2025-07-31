import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";
import "./utils/debug-commands"; // Import debug commands
import "./utils/logging";
import { createRoot, type Root } from "react-dom/client";
import {
  mountSplashScreen,
  unmountSplashScreen,
} from "./components/Layout/Splash.ts";
import "./index.css";
import { client as indexerClient } from "./service/indexer/generated/client.gen";

let root: Root;
let splashElement: HTMLElement;

// load wasm entry point, and lazy load sub-module so we don't have to worry
// about ordering of wasm module initialization
export async function boot() {
  const container = document.getElementById("root")!;

  // mount plain js splash screen
  splashElement = mountSplashScreen(container);

  await Promise.all([initKaspaWasm(), initCipherWasm()]);

  initConsolePanicHook();

  console.log("Kaspa SDK initialized successfully");

  // unmount splash screen and create react root
  unmountSplashScreen(splashElement);
  root = createRoot(container);

  // lazy load main
  const { loadApplication } = await import("./main");
  await loadApplication(root);

  indexerClient.setConfig({
    baseUrl:
      import.meta.env.VITE_DEFAULT_KASPA_NETWORK === "mainnet"
        ? import.meta.env.VITE_INDEXER_MAINNET_URL
        : import.meta.env.VITE_INDEXER_TESTNET_URL,
  });

  // lazy load network store and db store after the main app is running
  const [{ useNetworkStore }, { useDBStore }] = await Promise.all([
    import("./store/network.store"),
    import("./store/db.store"),
  ]);

  // connect to network if not connected
  const { connect, isConnected } = useNetworkStore.getState();
  if (!isConnected) connect();

  // init db if not initialized
  const { db, initDB } = useDBStore.getState();
  if (!db) initDB();
}

boot();
