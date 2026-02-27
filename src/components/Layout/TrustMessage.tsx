import React, { FC, useState } from "react";
import { Lock } from "lucide-react";
import { KasIcon } from "../icons/KasCoin";
import { setDevMode } from "../../config/dev-mode";
import { toast } from "../../utils/toast-helper";

export const TrustMessage: FC = () => {
  const [openTrust, setOpenTrust] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);

  const [, setDevModeClickTimes] = useState(0);

  const activateDevModeOnClickFiveTimes = () => {
    setDevModeClickTimes((v) => {
      if (v === 6) {
        setDevMode(true);
        // Defer the toast to avoid setState during render
        setTimeout(() => toast.info("Dev mode activated"), 0);
        return 0;
      } else {
        return v + 1;
      }
    });
  };

  return (
    <div className="mb-2 sm:mb-5">
      {/* trust message section */}
      <div
        className="border-kas-secondary from-kas-secondary/20 to-kas-secondary/5 mt-6 cursor-pointer rounded-2xl border bg-gradient-to-r p-1 sm:p-2"
        onClick={() => setOpenTrust((v) => !v)}
      >
        <div
          onClick={activateDevModeOnClickFiveTimes}
          className="flex w-full items-center justify-center gap-2 py-1"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#70C7BA]">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[var(--text-secondary)] select-none">
            Your keys, your messages
          </span>
        </div>

        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            openTrust ? "mt-2 max-h-32 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <p className="break-word mb-2 w-full text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            We never store your private keys or have access to your messages.
            Messages are encrypted and controlled by you.
          </p>
          <p className="break-word w-full text-center text-xs leading-relaxed text-[var(--text-secondary)]">
            You can even run Kasia yourself!
            <a
              href="https://github.com/K-Kluster/Kasia"
              target="_blank"
              rel="noopener noreferrer"
              className="break-word ml-1 text-[var(--text-secondary)] underline hover:text-gray-300"
            >
              github.com/K-Kluster/Kasia
            </a>
          </p>
        </div>
      </div>

      {/* why kaspa wallet section */}
      <div
        className="border-primary-border bg-primary-bg mt-3 cursor-pointer rounded-2xl border p-1 sm:p-2"
        onClick={() => setOpenWhy((v) => !v)}
      >
        <div className="mx-2 flex w-full items-center justify-center gap-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full">
            <KasIcon
              className="h-12 w-12 scale-180"
              circleClassName="fill-kas-secondary"
              kClassName="fill-[#ffffff]"
            />
          </div>
          <span className="text-center text-sm font-medium text-[var(--text-secondary)] select-none">
            Why do I need a Seed Phrase?
          </span>
        </div>

        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            openWhy ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <p className="break-word w-full px-0.5 text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            Kasia is a messaging app that protects your privacy. Your seed
            phrase is your secure login—no email, phone number, or personal
            details required. It proves ownership of your identity and allows
            you to recover access if your device is lost or replaced.
          </p>
          <p className="break-word w-full text-center text-xs leading-relaxed text-[var(--text-secondary)]">
            Kasia is community built by volunteers.
          </p>
        </div>
      </div>
    </div>
  );
};
