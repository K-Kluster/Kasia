import { FC, useState, useEffect, useRef, useMemo } from "react";
import { KasiaConversationEvent } from "../types/all";
import { decodePayload } from "../utils/format";
import { useWalletStore } from "../store/wallet.store";
import { WalletStorage } from "../utils/wallet-storage";
import { CipherHelper } from "../utils/cipher-helper";
import { HandshakeResponse } from "./HandshakeResponse";
import { KasIcon } from "./icons/KasCoin";
import { Paperclip, Tickets } from "lucide-react";
import clsx from "clsx";
import { parseMessageForDisplay } from "../utils/message-format";
import { Contact } from "../store/repository/contact.repository";
import { Conversation } from "../store/repository/conversation.repository";

type MessageDisplayProps = {
  event: KasiaConversationEvent;
  isOutgoing: boolean;
  contact: Contact;
  conversation: Conversation;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
};

export const MessageDisplay: FC<MessageDisplayProps> = ({
  event,
  contact,
  conversation,
  isOutgoing,
  showTimestamp,
  groupPosition = "single",
}) => {
  const [showMeta, setShowMeta] = useState(false);

  const walletStore = useWalletStore();
  const mounted = useRef(true);

  const isRecent = Date.now() - event.createdAt.getTime() < 12 * 60 * 60 * 1000; // if message is younger than 12 hours, its recent

  // if expanded OR stale, full date+time; otherwise just HH:MM
  const displayStamp =
    showMeta || !isRecent
      ? event.createdAt.toLocaleString()
      : event.createdAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

  // Get the correct explorer URL based on network
  const getExplorerUrl = (txId: string) => {
    return walletStore.selectedNetwork === "mainnet"
      ? `https://explorer.kaspa.org/txs/${txId}`
      : `https://explorer-tn10.kaspa.org/txs/${txId}`;
  };

  // Format amount or fee for display
  const formatAmountAndFee = () => {
    if (isOutgoing && event.fee !== undefined) {
      return (
        <div className="w-full">
          <div className="message-fee text-right">
            Fee: {event.fee.toFixed(8)} KAS
          </div>
        </div>
      );
    }
    return null; // Don't show amount for any messages
  };

  // Render payment message content
  const renderPaymentMessage = () => {
    if (isDecrypting) {
      return (
        <div className="rounded-md bg-teal-50 px-3 py-2 text-xs text-gray-600 italic">
          Decrypting payment message...
        </div>
      );
    }

    try {
      const paymentPayload = JSON.parse(event.content);

      if (paymentPayload.type === "payment") {
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
    } catch (error) {
      console.warn("Could not parse payment message:", error);
      // If we can't parse it but we know it's a payment message,
      // show the raw content for debugging
      console.log("Raw payment content:", event.content);
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

  // Parse and render message content
  const renderMessageContent = useMemo(() => {
    // If this is a handshake message and we found the conversation
    if (event.__type === "handshake") {
      // Only show handshake response UI if:
      // 1. The conversation is pending
      // 2. We didn't initiate it
      // 3. It hasn't been responded to yet
      if (conversation.status === "pending" && !conversation.initiatedByMe) {
        console.log(
          "Rendering handshake response for conversation:",
          conversation
        );
        return <HandshakeResponse conversation={conversation} />;
      }
      // For other handshake messages, just show the status text
      return conversation.status === "active"
        ? "Handshake completed"
        : conversation.initiatedByMe
          ? "Handshake sent"
          : "Handshake received";
    }

    // If this is a payment message, handle it specially
    if (event.__type === "payment") {
      return renderPaymentMessage();
    }

    // Wait for decryption attempt before showing content
    if (isDecrypting) {
      return (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">
          Decrypting message...
        </div>
      );
    }

    // Only use decrypted content if decryption was attempted and successful
    const messageToRender =
      (decryptionAttempted && decryptedContent) || event.content;

    if (event.__type === "message") {
      // Handle file/image messages
      if (event.fileData && event.fileData.type === "file") {
        if (event.fileData.mimeType.startsWith("image/")) {
          return (
            <img
              src={event.fileData.content}
              alt={event.fileData.name}
              className="mt-2 block max-w-full rounded-lg"
            />
          );
        }
        return (
          <div className="file-message">
            <div className="file-info">
              <Paperclip className="h-4 w-4 cursor-pointer" />{" "}
              {event.fileData.name} ({Math.round(event.fileData.size / 1024)}
              KB)
            </div>
            <button
              className="mt-1 cursor-pointer rounded border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.2)] px-3 py-1 text-sm text-[var(--text-primary)] transition-colors duration-200 hover:bg-[rgba(59,130,246,0.3)]"
              onClick={() => {
                const link = document.createElement("a");
                link.href = event.fileData!.content;
                link.download = event.fileData!.name;
                link.click();
              }}
            >
              Download
            </button>
          </div>
        );
      }
    }

    // Try to parse as JSON in case it's a file message in content
    try {
      const parsedContent = JSON.parse(messageToRender);
      if (parsedContent.type === "file") {
        if (parsedContent.mimeType.startsWith("image/")) {
          return (
            <img
              key={`img-${event.transactionId}`}
              src={parsedContent.content}
              alt={parsedContent.name}
              className="mt-2 block max-w-full rounded-lg"
            />
          );
        }
        return (
          <div key={`file-${event.transactionId}`} className="file-message">
            <div className="file-info">
              <Paperclip className="h-4 w-4" /> {parsedContent.name} (
              {Math.round((parsedContent.size || 0) / 1024)}KB)
            </div>
            <button
              className="mt-1 cursor-pointer rounded border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.2)] px-3 py-1 text-sm text-[var(--text-primary)] transition-colors duration-200 hover:bg-[rgba(59,130,246,0.3)]"
              onClick={() => {
                const link = document.createElement("a");
                link.href = parsedContent.content;
                link.download = parsedContent.name;
                link.click();
              }}
            >
              Download
            </button>
          </div>
        );
      }
    } catch (e) {
      // Not a JSON message, render as text
      void e;
    }

    // render plain text with newlines as <br /> and \\n as literal text
    if (typeof messageToRender === "string") {
      return parseMessageForDisplay(messageToRender);
    }

    return messageToRender;
  }, [
    conversation,
    event.__type,
    event.content,
    event.transactionId,
    renderPaymentMessage,
  ]);

  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptionAttempted, setDecryptionAttempted] =
    useState<boolean>(false);

  useEffect(() => {
    const decryptMessage = async () => {
      if (!mounted.current || !walletStore.unlockedWallet) {
        setDecryptionAttempted(true);
        return;
      }

      // If we already have decrypted content from the account service, use that
      if (event.content) {
        setDecryptedContent(event.content);
        setDecryptionAttempted(true);
        return;
      }

      setIsDecrypting(true);
      setDecryptionAttempted(false);

      try {
        // Add a small delay to ensure wallet is fully initialized
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!mounted.current) return;

        // Check if the payload starts with the cipher prefix
        const prefix = "ciph_msg:"
          .split("")
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("");

        if (event.content.startsWith(prefix)) {
          // Extract the encrypted message hex
          const encryptedHex = CipherHelper.stripPrefix(event.content);

          // Get the private key generator
          const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
            walletStore.unlockedWallet,
            walletStore.unlockedWallet.password
          );

          let decrypted: string | null = null;

          // Try decryption with receive key first
          try {
            const privateKey = privateKeyGenerator.receiveKey(0);
            decrypted = await CipherHelper.tryDecrypt(
              encryptedHex,
              privateKey.toString(),
              event.transactionId ||
                `${contact.kaspaAddress}-${event.createdAt.getTime()}`
            );
          } catch {
            // Try with change key as fallback
            try {
              const changeKey = privateKeyGenerator.changeKey(0);
              decrypted = await CipherHelper.tryDecrypt(
                encryptedHex,
                changeKey.toString(),
                event.transactionId ||
                  `${contact.kaspaAddress}-${event.createdAt.getTime()}`
              );
            } catch {
              throw new Error(
                "Failed to decrypt with both receive and change keys"
              );
            }
          }

          if (mounted.current && decrypted) {
            setDecryptedContent(decrypted);
          }
        } else {
          const decoded = decodePayload(event.content);
          if (mounted.current) {
            setDecryptedContent(decoded || "");
          }
        }
      } catch (error) {
        console.error("Error decrypting message:", error);
      } finally {
        if (mounted.current) {
          setIsDecrypting(false);
          setDecryptionAttempted(true);
        }
      }
    };

    decryptMessage();
  }, [
    walletStore.unlockedWallet,
    event.content,
    event.transactionId,
    event.createdAt,
    contact.kaspaAddress,
  ]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // determine the 'chat' style that we apply
  const bubbleClass = (() => {
    if (isOutgoing) {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tr-none rounded-br-none";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tr-none rounded-br-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-br-none";
    } else {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tl-none rounded-bl-none";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tl-none rounded-bl-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-bl-none";
    }
  })();

  return (
    <div
      className={clsx(
        "flex w-full",
        isOutgoing
          ? "justify-end pr-0.5 sm:pr-2"
          : "justify-start pl-0.5 sm:pl-2"
      )}
    >
      {showMeta && event.transactionId && isOutgoing && (
        <div className="mr-2 flex items-center">
          <a
            href={getExplorerUrl(event.transactionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-80 transition-opacity hover:opacity-100"
          >
            <Tickets className="size-5" />
          </a>
        </div>
      )}
      <div
        onClick={() => setShowMeta((prev) => !prev)}
        className={clsx(
          "relative z-0 mb-1 max-w-[70%] cursor-pointer px-4 py-1 text-left break-words hyphens-auto",
          isOutgoing
            ? "border border-[var(--button-primary)] bg-[var(--button-primary)]/20"
            : "bg-[var(--secondary-bg)]",
          bubbleClass
        )}
      >
        <div className="my-0.5 text-base leading-relaxed">
          {renderMessageContent}
        </div>
        {(showMeta || showTimestamp) && (
          <div className="mb-1.5 flex justify-end truncate text-xs">
            <div className="opacity-70">{displayStamp}</div>
          </div>
        )}
        {showMeta && (
          <div
            className={clsx(
              "mt-1.5 text-xs whitespace-nowrap opacity-80",
              isOutgoing
                ? "flex flex-col items-start space-y-1"
                : "flex flex-col items-start space-x-4 sm:flex-row sm:items-center sm:justify-between"
            )}
          >
            {formatAmountAndFee()}
          </div>
        )}
      </div>
      {showMeta && event.transactionId && !isOutgoing && (
        <div className="ml-2 flex items-center">
          <a
            href={getExplorerUrl(event.transactionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-80 transition-opacity hover:opacity-100"
          >
            <Tickets className="size-5" />
          </a>
        </div>
      )}
    </div>
  );
};
