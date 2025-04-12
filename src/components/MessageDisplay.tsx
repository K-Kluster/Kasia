import { FC } from "react";
import { Message as MessageType } from "../type/all";
import { decodePayload } from "../utils/all-in-one";
import { formatKasAmount } from "../utils/format";

type MessageDisplayProps = {
  message: MessageType;
  isOutgoing: boolean;
};

export const MessageDisplay: FC<MessageDisplayProps> = ({
  message,
  isOutgoing,
}) => {
  const {
    senderAddress,
    recipientAddress,
    timestamp,
    payload,
    content,
    amount,
    transactionId,
  } = message;
  const displayAddress = isOutgoing ? recipientAddress : senderAddress;

  const shortDisplayAddress =
    displayAddress && displayAddress !== "Unknown"
      ? `${displayAddress.substring(0, 12)}...${displayAddress.substring(
          displayAddress.length - 12
        )}`
      : "Unknown";

  const decodedPayload = payload ? decodePayload(payload) : content;

  return (
    <div className={`message ${isOutgoing ? "outgoing" : "incoming"}`}>
      <div className="message-header">
        <span className="message-from">
          {isOutgoing ? "To" : "From"}: {shortDisplayAddress}
        </span>
        <span className="message-time">
          {timestamp ? new Date(timestamp).toLocaleString() : "Pending"}
        </span>
      </div>
      <div className="message-content">{decodedPayload}</div>
      <div className="message-footer">
        <span className="message-id">TX: {transactionId || "Pending..."}</span>
        {amount && (
          <span className="message-amount">{formatKasAmount(amount)} KAS</span>
        )}
      </div>
    </div>
  );
};
