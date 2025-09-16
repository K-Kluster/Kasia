import { create } from "zustand";
import {
  DEFAULT_PASSWORD_TIMEOUT_MINUTES,
  DEFAULT_PASSWORD_REAUTH_THRESHOLD,
} from "../config/constants";
import { useFeatureFlagsStore, FeatureFlags } from "./featureflag.store";

type AuthState = {
  // password timeout settings
  passwordTimeoutMinutes: number;
  passwordReauthThreshold: bigint;
  lastPasswordEntry: Date | null;
  setPasswordTimeoutMinutes: (minutes: number) => void;
  setPasswordReauthThreshold: (threshold: bigint) => void;
  updateLastPasswordEntry: (timestamp?: Date) => void;
  isPasswordStale: () => boolean;
  requiresPasswordReauth: (amount: bigint) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  // password timeout settings
  passwordTimeoutMinutes: DEFAULT_PASSWORD_TIMEOUT_MINUTES,
  passwordReauthThreshold: DEFAULT_PASSWORD_REAUTH_THRESHOLD,
  lastPasswordEntry: null,

  setPasswordTimeoutMinutes: (minutes: number) => {
    set({ passwordTimeoutMinutes: minutes });
  },
  setPasswordReauthThreshold: (threshold: bigint) => {
    set({ passwordReauthThreshold: threshold });
  },
  updateLastPasswordEntry: (timestamp?: Date) => {
    set({ lastPasswordEntry: timestamp || new Date() });
  },
  isPasswordStale: () => {
    const state = get();
    if (!state.lastPasswordEntry) return true;

    const now = new Date();
    const timeoutMs = state.passwordTimeoutMinutes * 60 * 1000;
    const timeSinceLastEntry =
      now.getTime() - state.lastPasswordEntry.getTime();

    return timeSinceLastEntry > timeoutMs;
  },
  requiresPasswordReauth: (amount: bigint) => {
    // check if password reauth is disabled via feature flag
    const featureFlags = useFeatureFlagsStore.getState().flags;
    if (featureFlags[FeatureFlags.DISABLE_PASSWORD_REAUTH]) {
      return false; // if disabled, then skip this
    }

    const state = get();
    return amount >= state.passwordReauthThreshold && state.isPasswordStale();
  },
}));
