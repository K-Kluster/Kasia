import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";
import { useWalletStore } from "./store/wallet.store";
import './utils/debug-commands';  // Import debug commands

// load wasm entry point, and lazy load sub-module so we don't have to worry
// about ordering of wasm module initialization
export async function boot() {
  await initKaspaWasm();

  await initCipherWasm();

  initConsolePanicHook();

  // @QUESTION: what purpose does it have?
  window.dispatchEvent(new Event("kaspa-sdk-ready"));
  console.log("Kaspa SDK initialized successfully");

  // lazy load main
  await (await import("./main")).loadApplication();
}

boot();
