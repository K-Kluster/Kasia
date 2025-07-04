import React, { FC, useState } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { KasIcon } from "../icons/KasCoin";

export const TrustMessage: FC = () => {
  const [openTrust, setOpenTrust] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);

  return (
    <>
      {/* trust message section */}
      <div className="mt-6 rounded-lg border border-[#70C7BA]/20 bg-gradient-to-br from-[#70C7BA]/10 to-[#70C7BA]/5 p-2">
        <div
          className="flex cursor-pointer items-center justify-center gap-2"
          onClick={() => setOpenTrust((v) => !v)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#70C7BA]">
            <LockClosedIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-300">
            Your keys, your messages
          </span>
        </div>

        {openTrust && (
          <>
            <p className="break-word mb-2 w-full text-center text-xs leading-relaxed text-gray-400">
              We never store your private keys or have access to your messages.
              Everything is encrypted and controlled by you.
            </p>
            <p className="break-word mx-auto w-full max-w-md text-center text-xs leading-relaxed text-gray-400">
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
      <div className="mt-3 rounded-lg border border-[#B6B6B6]/20 bg-gradient-to-br from-[#B6B6B6]/10 to-[#B6B6B6]/5 p-2">
        <div
          className="flex cursor-pointer items-center justify-center gap-2"
          onClick={() => setOpenWhy((v) => !v)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B6B6B6]">
            <KasIcon
              className="h-6 w-6 scale-120"
              circleClassName="fill-white"
              kClassName="fill-[#B6B6B6]"
            />
          </div>
          <span className="text-sm font-medium text-gray-300">
            Why do I need a Kaspa wallet?
          </span>
        </div>

        {openWhy && (
          <p className="break-word mx-auto w-full max-w-md text-center text-xs leading-relaxed text-gray-400">
            Kasia is a private messaging app that protects your privacy. Your
            Kaspa wallet acts as your secure login – no email, phone number, or
            personal details needed. Messages are encrypted and stored on the
            Kaspa blockDAG, making them completely private and decentralized.
          </p>
        )}
      </div>
    </>
  );
};
