import { useAuthStore } from "../store/auth.store";
import { useUiStore } from "../store/ui.store";

// track reauth completion
let reauthResolve: ((success: boolean) => void) | null = null;

/**
 * check if password reauthentication is required for a transaction amount
 */
export function needsPasswordReauth(amount: bigint): boolean {
  return useAuthStore.getState().requiresPasswordReauth(amount);
}

/**
 * complete password reauthentication with success/failure
 * called by the modal when user completes auth
 */
export function completePasswordReauth(success: boolean) {
  if (reauthResolve) {
    reauthResolve(success);
    reauthResolve = null;
  }
}

/**
 * show the password reauthentication modal and return a promise that resolves
 * to true if authentication was successful, false if cancelled/failed
 */
export function showPasswordReauthModal(): Promise<boolean> {
  return new Promise((resolve) => {
    // store the resolve function to call later
    reauthResolve = resolve;

    // open the modal
    useUiStore.getState().openModal("password-reauth");
  });
}
