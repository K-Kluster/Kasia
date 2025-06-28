import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm from "cipher";
import "./utils/debug-commands"; // Import debug commands
import "./utils/logging";
import { createRoot } from "react-dom/client";
import { SplashScreen } from "./components/Layout/Splash";

// Create a single root instance that we'll reuse
const root = createRoot(document.getElementById("root")!);

// load wasm entry point, and lazy load sub-module so we don't have to worry
// about ordering of wasm module initialization
export async function boot() {
  // Render splash screen
  root.render(await SplashScreen({}));

  await initKaspaWasm();

  await initCipherWasm();

  initConsolePanicHook();

  console.log("Kaspa SDK initialized successfully");

  // Export root for reuse in main.tsx
  window.__APP_ROOT__ = root;

  // lazy load main
  await (await import("./main")).loadApplication();
}

boot();
