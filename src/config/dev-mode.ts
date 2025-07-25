export let devMode = import.meta.env.VITE_DEV_MODE === "true" || false;

// Function to set the dev mode
export function setDevMode(mode: boolean) {
  devMode = mode;
}
