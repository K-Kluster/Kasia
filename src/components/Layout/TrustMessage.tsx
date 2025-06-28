import React, { FC, useState } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { KasIcon } from "../icons/KasCoin";

export const TrustMessage: FC = () => {
  const [openTrust, setOpenTrust] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);

  return (
    <>
      {/* trust message section */}
      <div className="mt-8 p-2 bg-gradient-to-br from-[#70C7BA]/10 to-[#70C7BA]/5 border border-[#70C7BA]/20 rounded-lg">
        <div
          className="flex items-center justify-center gap-2 cursor-pointer"
          onClick={() => setOpenTrust((v) => !v)}
        >
          <div className="w-6 h-6 rounded-full bg-[#70C7BA] flex items-center justify-center">
            <LockClosedIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-gray-300 font-medium text-sm">
            Your keys, your messages
          </span>
        </div>

        {openTrust && (
          <>
            <p className="w-full text-center text-xs text-gray-400 leading-relaxed mb-2 break-word">
              We never store your private keys or have access to your messages.
              Everything is encrypted and controlled by you.
            </p>
            <p className="w-full max-w-md mx-auto text-center text-xs text-gray-400 leading-relaxed break-word">
              You can even run Kasia yourself!
              <a
                href="https://github.com/K-Kluster/Kasia"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline hover:text-gray-300 text-gray-400 break-word"
              >
                github.com/K-Kluster/Kasia
              </a>
            </p>
          </>
        )}
      </div>

      {/* why kaspa wallet section */}
      <div className="mt-4 p-2 bg-gradient-to-br from-[#B6B6B6]/10 to-[#B6B6B6]/5 border border-[#B6B6B6]/20 rounded-lg">
        <div
          className="flex items-center justify-center gap-2 cursor-pointer"
          onClick={() => setOpenWhy((v) => !v)}
        >
          <div className="w-6 h-6 rounded-full bg-[#B6B6B6] flex items-center justify-center">
            <KasIcon
              className="w-4 h-4"
              circleClassName="fill-white"
              kClassName="fill-[#B6B6B6]"
            />
          </div>
          <span className="text-gray-300 font-medium text-sm">
            Why do I need a Kaspa wallet?
          </span>
        </div>

        {openWhy && (
          <p className="w-full max-w-md mx-auto text-center text-xs text-gray-400 leading-relaxed break-word">
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
