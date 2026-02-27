import { useMemo, useState } from "react";
import { kaspaToSompi } from "kaspa-wasm";
import { WarningBlock } from "../../Common/WarningBlock";
import { Button } from "../../Common/Button";
import { useMessagingStore } from "../../../store/messaging.store";
import { OneOnOneConversation } from "../../../types/all";

type ConversationUpgradeNoticeProps = {
  oneOnOneConversation: OneOnOneConversation;
};

const toMillis = (value: Date | number): number =>
  value instanceof Date ? value.getTime() : Number(value);

export const ConversationUpgradeNotice = ({
  oneOnOneConversation,
}: ConversationUpgradeNoticeProps) => {
  const messagingStore = useMessagingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { contact, events } = oneOnOneConversation;

  const {
    latestIncomingHandshake,
    latestOutgoingHandshake,
    mode,
  }: {
    latestIncomingHandshake: (typeof events)[number] | null;
    latestOutgoingHandshake: (typeof events)[number] | null;
    mode: "initiate" | "respond" | "waiting";
  } = useMemo(() => {
    const handshakeEvents = events.filter(
      (event) => event.__type === "handshake"
    );
    const incoming = handshakeEvents
      .filter((event) => !event.fromMe)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const outgoing = handshakeEvents
      .filter((event) => event.fromMe)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    const incomingTs = incoming ? incoming.createdAt.getTime() : -1;
    const outgoingTs = outgoing ? outgoing.createdAt.getTime() : -1;

    if (incomingTs > outgoingTs) {
      return {
        latestIncomingHandshake: incoming ?? null,
        latestOutgoingHandshake: outgoing ?? null,
        mode: "respond" as const,
      };
    }

    if (outgoing) {
      return {
        latestIncomingHandshake: incoming ?? null,
        latestOutgoingHandshake: outgoing ?? null,
        mode: "waiting" as const,
      };
    }

    return {
      latestIncomingHandshake: incoming ?? null,
      latestOutgoingHandshake: outgoing ?? null,
      mode: "initiate" as const,
    };
  }, [events]);

  const sendUpgradeHandshake = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await messagingStore.initiateHandshake(
        contact.kaspaAddress,
        kaspaToSompi("0.2")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send handshake");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendUpgradeResponse = async () => {
    if (!latestIncomingHandshake) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await messagingStore.respondToHandshake(
        String(latestIncomingHandshake.id)
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to send handshake response"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WarningBlock title="Conversation Upgrade" className="mx-2 mt-3 mb-2">
      <div className="space-y-2">
        {mode === "initiate" && (
          <>
            <p>
              This conversation was created with the legacy alias model. Send a
              handshake to upgrade routing reliability.
            </p>
            <Button
              variant="primary"
              onClick={sendUpgradeHandshake}
              disabled={isSubmitting}
              className="!mt-1 !w-auto !rounded-xl !px-4 !py-2 text-sm"
            >
              {isSubmitting ? "Sending..." : "Send Upgrade Handshake"}
            </Button>
          </>
        )}

        {mode === "respond" && (
          <>
            <p>
              This contact requested a conversation upgrade. Send a handshake
              response to finish the upgrade.
            </p>
            <Button
              variant="primary"
              onClick={sendUpgradeResponse}
              disabled={isSubmitting}
              className="!mt-1 !w-auto !rounded-xl !px-4 !py-2 text-sm"
            >
              {isSubmitting ? "Sending..." : "Send Upgrade Response"}
            </Button>
          </>
        )}

        {mode === "waiting" && (
          <p>
            Upgrade handshake sent. Waiting for the other participant to send a
            response.
          </p>
        )}

        {latestOutgoingHandshake && mode !== "respond" && (
          <p className="opacity-80">
            Last outgoing handshake:{" "}
            {new Date(
              toMillis(latestOutgoingHandshake.createdAt)
            ).toLocaleString()}
          </p>
        )}

        {error && <p className="text-[var(--accent-red)]">{error}</p>}
      </div>
    </WarningBlock>
  );
};
