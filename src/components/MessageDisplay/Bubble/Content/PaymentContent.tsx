import { FC } from "react";
import { KasIcon } from "../../../icons/KasCoin";
import { PROTOCOL } from "../../../../config/protocol";
import clsx from "clsx";

type PaymentContentProps = {
  content: string | null;
  isOutgoing: boolean;
  isDecrypting: boolean;
};

export const PaymentContent: FC<PaymentContentProps> = ({
  content,
  isOutgoing,
  isDecrypting,
}) => {
  if (isDecrypting) {
    return (
      <div className="rounded-md bg-teal-50 px-3 py-2 text-xs text-gray-600 italic">
        Decrypting payment message...
      </div>
    );
  }

  // For payment messages, we'll only show the UI elements, not the raw content
  const messageToRender = content;

  try {
    if (messageToRender) {
      const paymentPayload = JSON.parse(messageToRender);

      if (paymentPayload.type === PROTOCOL.headers.PAYMENT.type) {
        // Check if message is empty or just whitespace
        const hasMessage =
          paymentPayload.message && paymentPayload.message.trim();

        return (
          <div className={clsx("flex items-center gap-1")}>
            <div
              className={clsx(
                "mr-2 flex h-18 w-18 animate-pulse items-center justify-center drop-shadow-[0_0_20px_rgba(112,199,186,0.7)]"
              )}
            >
              <KasIcon
                className="h-18 w-18 scale-140 cursor-pointer drop-shadow-[0_0_15px_rgba(112,199,186,0.8)]"
                circleClassName="fill-white"
                kClassName="fill-[var(--kas-primary)]"
              />
            </div>
            <div className="flex-1">
              {hasMessage && (
                <div className="mb-1 text-sm font-medium break-all drop-shadow-sm">
                  {paymentPayload.message}
                </div>
              )}
              <div className="text-xs font-semibold drop-shadow-sm">
                {isOutgoing ? "Sent" : "Received"} {paymentPayload.amount} KAS
              </div>
            </div>
          </div>
        );
      }
    }
  } catch (error) {
    console.warn("Could not parse payment message:", error);
    // If we can't parse it but we know it's a payment message,
    // show the raw content for debugging
    console.log("Raw payment content:", messageToRender);
  }

  // Fallback to showing basic payment info
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="mr-1 flex h-10 min-w-10 items-center justify-center drop-shadow-[0_0_20px_rgba(112,199,186,0.7)]">
        <KasIcon
          className="h-10 w-10 drop-shadow-[0_0_15px_rgba(112,199,186,0.8)]"
          circleClassName="fill-white"
          kClassName="fill-[#70C7BA]"
        />
      </div>
      <div className="flex-1">
        <div className="mb-1 text-sm font-medium drop-shadow-sm">
          Payment message
        </div>
        <div className="text-xs font-semibold drop-shadow-sm">
          {isOutgoing ? "Sent" : "Received"} payment
        </div>
      </div>
    </div>
  );
};
