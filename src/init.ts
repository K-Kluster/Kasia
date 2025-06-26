import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";
import "./utils/debug-commands"; // Import debug commands
import "./utils/logging";
import { createRoot } from "react-dom/client";
import { SplashScreen } from "./components/Layout/Splash";
import { useNetworkStore } from "./store/network.store";

// load wasm entry point, and lazy load sub-module so we don't have to worry
// about ordering of wasm module initialization
export async function boot() {
  createRoot(document.getElementById("root")!).render(await SplashScreen({}));

  await initKaspaWasm();

  await initCipherWasm();

  initConsolePanicHook();

  console.log("Kaspa SDK initialized successfully");

  // connect before we do anything, we always need to be connected
  const { connect, isConnected } = useNetworkStore.getState();
  if (!isConnected) connect();

  // lazy load main
  await (await import("./main")).loadApplication();
}

boot();
