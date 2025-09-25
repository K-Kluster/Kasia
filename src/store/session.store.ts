import { core } from "@tauri-apps/api";
import { create } from "zustand";
import {
  hasData,
  setData,
  getData,
  checkStatus,
} from "@tauri-apps/plugin-biometry";
import { platform } from "@tauri-apps/plugin-os";

type SessionState = {
  supportSecuredBiometry: () => Promise<boolean>;

  /**
   * Can be called on any plateform, no-op is secured biometry isn't supported
   */
  setSession: (tenantId: string, password: string) => Promise<void>;
  /**
   * Can be called on any plateform, return false if secured biometry isn't supported
   */
  hasSession: (tenantId: string) => Promise<boolean>;

  /**
   * Prompt an authentication prior getting the session
   * You must call `hasSession` to check if a session exists first
   *
   * @returns the stored password
   */
  getSession: (tenantId: string) => Promise<string | null>;
};

export const useSessionState = create<SessionState>((set, get) => {
  return {
    async supportSecuredBiometry() {
      try {
        if (!core.isTauri()) {
          return false;
        }

        // temporary disable for iOS
        if (platform() === "ios") {
          return false;
        }

        const status = await checkStatus();

        return status.isAvailable;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    async getSession(tenantId) {
      // safeguard is case of mis-use in browser context
      if (!core.isTauri()) {
        return null;
      }

      // temporary disable for iOS
      if (platform() === "ios") {
        return null;
      }

      const data = await getData({
        domain: "kas.kluster.kasia",
        name: `${tenantId}.password`,
        reason: "Access your messages",
        cancelTitle: "Use Password",
      });

      return data?.data ?? null;
    },
    async hasSession(tenantId) {
      if (!core.isTauri()) {
        return false;
      }

      // temporary disable for iOS
      if (platform() === "ios") {
        return false;
      }

      if (!(await get().supportSecuredBiometry())) {
        return false;
      }

      return hasData({
        domain: "kas.kluster.kasia",
        name: `${tenantId}.password`,
      });
    },
    async setSession(tenantId, password) {
      if (!core.isTauri()) {
        return;
      }

      // temporary disable for iOS
      if (platform() === "ios") {
        return;
      }

      if (!(await get().supportSecuredBiometry())) {
        return;
      }

      await setData({
        data: password,
        domain: "kas.kluster.kasia",
        name: `${tenantId}.password`,
      });
    },
  };
});
