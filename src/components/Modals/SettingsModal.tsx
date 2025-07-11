import React, { useState, useEffect } from "react";
import { useUiStore } from "../../store/ui.store";
import { Modal } from "../Common/modal";
import clsx from "clsx";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: "account", label: "Account" },
  { id: "theme", label: "Theme" },
  { id: "security", label: "Security" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("account");
  const [isMobile, setIsMobile] = useState(false);
  const { theme, setTheme } = useUiStore();

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("settings-modal-open");
    } else {
      document.body.classList.remove("settings-modal-open");
    }
    return () => {
      document.body.classList.remove("settings-modal-open");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div
        className={clsx("bg-primary-bg relative rounded-xl shadow-lg", {
          "fixed right-0 bottom-0 left-0 h-[80vh] w-full overflow-hidden rounded-t-3xl rounded-b-none":
            isMobile,
          "h-[500px] w-full max-w-2xl": !isMobile,
        })}
      >
        <div
          className={clsx("flex h-full", {
            "flex-col": isMobile,
            "flex-row": !isMobile,
          })}
        >
          {/* Sidebar */}
          <div
            className={clsx("border-r p-4", {
              "relative h-[80px] w-full border-r-0 border-b-0 pb-0": isMobile,
              "w-48": !isMobile,
            })}
          >
            <nav
              className={clsx({
                "flex space-x-4 overflow-x-auto pb-2": isMobile,
                "space-y-1": !isMobile,
              })}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                    {
                      "mx-2 min-w-[80px] flex-col items-center justify-center":
                        isMobile,
                      "w-full": !isMobile,
                      "text-primary border-primary border-b-2":
                        isMobile && activeTab === tab.id,
                      "text-primary bg-primary/10 rounded-lg":
                        !isMobile && activeTab === tab.id,
                      "text-muted-foreground": activeTab !== tab.id,
                    }
                  )}
                >
                  {/* Simple icons for demo purposes */}
                  {tab.id === "account" && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                  {tab.id === "theme" && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.95 7.05l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  )}
                  {tab.id === "security" && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 11c1.657 0 3-1.343 3-3V5a3 3 0 10-6 0v3c0 1.657 1.343 3 3 3zm6 2v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5"
                      />
                    </svg>
                  )}
                  {tab.label}
                </button>
              ))}
            </nav>
            {isMobile && (
              <div className="bg-primary-border absolute right-0 bottom-[-20px] left-0 z-10 h-[1px]"></div>
            )}
          </div>
          {/* Content */}
          <div
            className={clsx("flex-1 overflow-y-auto p-6", {
              "h-[calc(80vh-80px)]": isMobile,
            })}
          >
            {activeTab === "account" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                <h3 className="mb-4 text-lg font-medium">Account</h3>
                <div className="bg-secondary-bg rounded-lg p-4">
                  <p className="text-muted-foreground text-sm">
                    Account settings content goes here.
                  </p>
                </div>
              </div>
            )}
            {activeTab === "theme" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                <h3 className="mb-4 text-lg font-medium">Theme</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={`border-primary-border flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                      theme === "light"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-secondary-bg"
                    }`}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.95 7.05l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`border-primary-border flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                      theme === "dark"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-secondary-bg"
                    }`}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`border-primary-border flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                      theme === "system"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-secondary-bg"
                    }`}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm font-medium">System</span>
                  </button>
                </div>
              </div>
            )}
            {activeTab === "security" && (
              <div className="mt-4 space-y-6 sm:mt-0">
                <h3 className="mb-4 text-lg font-medium">Security</h3>
                <div className="bg-secondary-bg rounded-lg p-4">
                  <p className="text-muted-foreground text-sm">
                    Security settings content goes here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
