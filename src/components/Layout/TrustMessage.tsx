import React, { FC, useState } from "react";
import { Lock } from "lucide-react";
import { KasIcon } from "../icons/KasCoin";

export const TrustMessage: FC = () => {
  const [openTrust, setOpenTrust] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);

  return (
    <div className="mb-2 sm:mb-5">
      {/* trust message section */}
      <div
        className="border-kas-secondary from-kas-secondary/20 to-kas-secondary/5 mt-6 cursor-pointer rounded-2xl border bg-gradient-to-r p-2"
        onClick={() => setOpenTrust((v) => !v)}
      >
        <div className="flex w-full items-center justify-center gap-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#70C7BA]">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <span className="text-secondary-text text-sm font-medium">
            Your keys, your messages
          </span>
        </div>

        {openTrust && (
          <>
            <p className="break-word mb-2 w-full text-center text-sm leading-relaxed text-gray-400">
              We never store your private keys or have access to your messages.
              Everything is encrypted and controlled by you.
            </p>
            <p className="break-word w-full text-center text-xs leading-relaxed text-gray-400">
              You can even run Kasia yourself!
              <a
                href="https://github.com/K-Kluster/Kasia"
                target="_blank"
                rel="noopener noreferrer"
                className="break-word ml-1 text-gray-400 underline hover:text-gray-300"
              >
                github.com/K-Kluster/Kasia
              </a>
            </p>
          </>
        )}
      </div>

      {/* why kaspa wallet section */}
      <div
        className="border-primary-border bg-primary-bg mt-3 cursor-pointer rounded-2xl border p-2"
        onClick={() => setOpenWhy((v) => !v)}
      >
        <div className="flex w-full items-center justify-center gap-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full">
            <KasIcon
              className="h-12 w-12 scale-180"
              circleClassName="fill-kas-secondary"
              kClassName="fill-[#ffffff]"
            />
          </div>
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Why do I need a Kaspa wallet?
          </span>
        </div>

        {openWhy && (
          <p className="break-word w-full text-center text-sm leading-relaxed text-gray-400">
            Kasia is a private messaging app that protects your privacy. Your
            Kaspa wallet acts as your secure login – no email, phone number, or
            personal details needed. Messages are encrypted and stored on the
            Kaspa blockDAG, making them completely private and decentralized.
          </p>
        )}
      </div>
    </div>
  );
};
