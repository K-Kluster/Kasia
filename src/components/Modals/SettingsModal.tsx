import React, { useState, useEffect } from "react";
import { useUiStore } from "../../store/ui.store";
import { Modal } from "../Common/modal";
import clsx from "clsx";
import { User, Info, Settings, Sun, Moon, Monitor } from "lucide-react";

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
                      "text-primary bg-secondary-bg border-primary-border rounded-lg border":
                        !isMobile && activeTab === tab.id,
                      "text-muted-foreground": activeTab !== tab.id,
                    }
                  )}
                >
                  {/* Simple icons for demo purposes */}
                  {tab.id === "account" && (
                    <User className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.id === "theme" && (
                    <Info className="h-5 w-5 text-[var(--text-primary)]" />
                  )}
                  {tab.id === "security" && (
                    <Settings className="h-5 w-5 text-[var(--text-primary)]" />
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
                    <Sun className="h-5 w-5 text-[var(--text-primary)]" />
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
                    <Moon className="h-5 w-5 text-[var(--text-primary)]" />
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
                    <Monitor className="h-5 w-5 text-[var(--text-primary)]" />
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
