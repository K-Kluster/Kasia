import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";

// load wasm entry point, and lazy load sub-module so we don't have to worry
// any it's initialization later on
const boot = async () => {
  await initKaspaWasm();

  await initCipherWasm();

  initConsolePanicHook();

  // @QUESTION: what purpose does it have?
  window.dispatchEvent(new Event("kaspa-sdk-ready"));
  console.log("Kaspa SDK initialized successfully");

  // lazy load main
  await (await import("./main")).loadApplication();
};

boot();
