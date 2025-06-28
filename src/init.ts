import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";
import "./utils/debug-commands"; // Import debug commands
import "./utils/logging";
import { createRoot, type Root } from "react-dom/client";
import { SplashScreen } from "./components/Layout/Splash";
import "./index.css";

let root: Root;

// load wasm entry point, and lazy load sub-module so we don't have to worry
// about ordering of wasm module initialization
export async function boot() {
  const container = document.getElementById("root")!;
  root = createRoot(container);
  root.render(await SplashScreen({}));

  await initKaspaWasm();
  await initCipherWasm();
  initConsolePanicHook();

  console.log("Kaspa SDK initialized successfully");

  // lazy load main
  const { loadApplication } = await import("./main");
  await loadApplication(root);

  // lazy load network store after the main app is running
  const { useNetworkStore } = await import("./store/network.store");
  const { connect, isConnected } = useNetworkStore.getState();
  if (!isConnected) connect();
}

boot();
