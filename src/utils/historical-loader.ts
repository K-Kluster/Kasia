import { decrypt_message, EncryptedMessage, PrivateKey } from "cipher";
import {
  HandshakeResponse,
  SelfStashResponse,
} from "../service/indexer/generated";
import { WalletStorageService } from "../service/wallet-storage-service";
import { Repositories } from "../store/repository/db";
import { useWalletStore } from "../store/wallet.store";
import { OneOnOneConversation } from "../types/all";
import {
  HandshakePayload,
  SavedHandshakePayload,
} from "../types/messaging.types";
import { MetadataV1 } from "../store/repository/meta.repository";
import { ConversationManagerService } from "../service/conversation-manager-service";
import { Handshake } from "../store/repository/handshake.repository";
import { useBlocklistStore } from "../store/blocklist.store";

export const historicalLoader_loadSendAndReceivedHandshake = async (
  repositories: Repositories,
  getHistoricalHandshakes: () => Promise<{
    receivedHandshakes: ({ __type: "received" } & HandshakeResponse)[];
    sentHandshakes: ({ __type: "sent" } & SelfStashResponse)[];
  }>,
  currentOneOnOneConversations: OneOnOneConversation[],
  conversationManager: ConversationManagerService,
  metadata: MetadataV1
): Promise<{
  ooocsByAddress: Map<string, OneOnOneConversation>;
  resolvedUnknownReceivedHandshakesAliasesBySenderAddress: Record<
    string,
    Set<string>
  >;
}> => {
  const handshakeReponses = await getHistoricalHandshakes();

  console.log("Loading Strategy - Processing Handshake from upstream", {
    handshakeReponses,
  });

  const unlockedWallet = useWalletStore.getState().unlockedWallet;
  if (!unlockedWallet) {
    throw new Error("Wallet not unlocked");
  }
  const privateKeyString =
    WalletStorageService.getPrivateKey(unlockedWallet).toString();

  const ooocs = currentOneOnOneConversations;
  const ooocsByAddress: Map<string, OneOnOneConversation> = new Map();

  const lastSentHSBySenderAddress: Map<
    string,
    {
      payload: SavedHandshakePayload;
      selfStash: SelfStashResponse;
    }
  > = new Map();
  const lastReceivedHSBySenderAddress: Map<
    string,
    { handshake: HandshakeResponse; payload: HandshakePayload }
  > = new Map();
  const resolvedUnknownReceivedHandshakesAliasesBySenderAddress: Record<
    string,
    Set<string>
  > = {};

  // try find the last saved stashed element per recipient address
  for (const stashedElement of handshakeReponses.sentHandshakes.sort((a, b) =>
    Number(b.block_time - a.block_time)
  )) {
    if (!stashedElement.owner) {
      continue;
    }

    // skip if already known locally
    if (
      await repositories.savedHandshakeRepository.doesExistsById(
        `${unlockedWallet.id}_${stashedElement.tx_id}`
      )
    ) {
      continue;
    }

    // parse decrypted message that we assume they are saved hanshake payloads
    try {
      // try decrypt self stash elements that we assume they are saved handshakes
      const encryptedMessage = new EncryptedMessage(
        stashedElement.stashed_data
      );
      const privateKey = new PrivateKey(privateKeyString);
      const decrypted = decrypt_message(encryptedMessage, privateKey);

      const savedHandshakePayload: SavedHandshakePayload =
        JSON.parse(decrypted);

      const sentHS = lastSentHSBySenderAddress.get(
        savedHandshakePayload.recipientAddress
      );
      // only consider the last saved handshake for our recipient
      // since we loop by last first, we can skip this iteration if already exist
      if (sentHS) {
        continue;
      }
      lastSentHSBySenderAddress.set(savedHandshakePayload.recipientAddress, {
        payload: savedHandshakePayload,
        selfStash: { ...stashedElement },
      });
      break;
    } catch (error) {
      console.warn("Cannot process sent handshake", error);
    }
  }

  for (const handshake of handshakeReponses.receivedHandshakes.sort((a, b) =>
    Number(b.block_time - a.block_time)
  )) {
    // skip is already ingested locally
    if (
      await repositories.handshakeRepository.doesExistsById(
        `${unlockedWallet.id}_${handshake.tx_id}`
      )
    ) {
      continue;
    }

    // if handshake is in blocked list, ignore
    const blocklistStore = useBlocklistStore.getState();
    if (blocklistStore.blockedAddresses.has(handshake.sender)) {
      console.log(
        `Skipping historical handshake processing for blocked address: ${handshake.sender}`
      );
      continue;
    }

    try {
      const encryptedMessage = new EncryptedMessage(handshake.message_payload);

      const privateKey = new PrivateKey(privateKeyString);
      const decryptedPart = decrypt_message(encryptedMessage, privateKey);

      const handshakePayload =
        conversationManager.parseHandshakePayload(decryptedPart);

      if (!handshakePayload) {
        continue;
      }

      // only consider the last saved handshake for our recipient
      // since we loop by last first, we can skip this iteration if already exist
      const handshakes = lastReceivedHSBySenderAddress.get(handshake.sender);

      if (!handshakes) {
        lastReceivedHSBySenderAddress.set(handshake.sender, {
          handshake,
          payload: handshakePayload,
        });
      }

      // mark the discovered alias
      const existing =
        !resolvedUnknownReceivedHandshakesAliasesBySenderAddress[
          handshake.sender
        ];
      if (!existing) {
        resolvedUnknownReceivedHandshakesAliasesBySenderAddress[
          handshake.sender
        ] = new Set(handshakePayload.alias);
      } else {
        resolvedUnknownReceivedHandshakesAliasesBySenderAddress[
          handshake.sender
        ].add(handshakePayload.alias);
      }
    } catch {
      // no-op
    }
  }

  for (const oooc of ooocs) {
    ooocsByAddress.set(oooc.contact.kaspaAddress, oooc);
  }

  const uniqueSenderAddresses = new Set([
    ...lastReceivedHSBySenderAddress.keys(),
    ...lastSentHSBySenderAddress.keys(),
  ]);

  let lastProcessedHandhshakeBlockTime = metadata.lastHandshakeBlockTime;
  let lastProcessedSavedHandshakeBlockTime =
    metadata.lastSavedHandshakeBlockTime;

  const processOneSender = async (senderAddress: string) => {
    let oooc = ooocsByAddress.get(senderAddress);

    const lastSentHS = lastSentHSBySenderAddress.get(senderAddress);
    if (lastSentHS) {
      try {
        await conversationManager.hydrateFromSavedHanshaked(
          lastSentHS.payload,
          lastSentHS.selfStash.tx_id
        );
        if (
          lastProcessedSavedHandshakeBlockTime <=
          Number(lastSentHS.selfStash.block_time)
        ) {
          lastProcessedSavedHandshakeBlockTime = Number(
            lastSentHS.selfStash.block_time
          );
        }
      } catch (error) {
        console.error(
          "Messaging Store - Error while ingesting last sent handshake",
          error
        );
      }
    }

    const lastReceivedHS = lastReceivedHSBySenderAddress.get(senderAddress);
    if (lastReceivedHS?.handshake?.sender) {
      try {
        await conversationManager.processHandshake(
          senderAddress,
          lastReceivedHS.payload
        );
        if (
          lastProcessedHandhshakeBlockTime <=
          Number(lastReceivedHS.handshake.block_time)
        ) {
          lastProcessedHandhshakeBlockTime = Number(
            lastReceivedHS.handshake.block_time
          );
        }
      } catch (error) {
        console.error(
          "Messaging Store - Error while ingesting last received handshake",
          error
        );
      }
    }

    // get updated conversation from manager
    const conversationWithContact =
      conversationManager.getConversationWithContactByAddress(senderAddress);

    if (!conversationWithContact) {
      // shouldn't happen
      console.warn(
        `Failed to get conversation with contact while processing handshake for ${senderAddress}, processing next handshake...`
      );
      return;
    }

    if (!oooc) {
      oooc = {
        conversation: conversationWithContact.conversation,
        contact: conversationWithContact.contact,
        events: [],
      };
    }

    const kasiaHandshakesToPersist: Handshake[] = [];

    if (lastSentHS) {
      kasiaHandshakesToPersist.push({
        __type: "handshake",
        amount: 0.2,
        contactId: oooc.contact.id,
        conversationId: oooc.conversation.id,
        content: "Handshake Sent",
        fromMe: true,
        createdAt: new Date(Number(lastSentHS.selfStash.block_time)),
        tenantId: unlockedWallet.id,
        transactionId: lastSentHS.selfStash.tx_id,
        id: `${unlockedWallet.id}_${lastSentHS.selfStash.tx_id}`,
        fee: 0,
      });
    }

    if (lastReceivedHS) {
      kasiaHandshakesToPersist.push({
        __type: "handshake",
        amount: 0.2,
        contactId: oooc.contact.id,
        conversationId: oooc.conversation.id,
        content: JSON.stringify(lastReceivedHS.payload),
        fromMe: false,
        createdAt: new Date(Number(lastReceivedHS.handshake.block_time)),
        tenantId: unlockedWallet.id,
        transactionId: lastReceivedHS.handshake.tx_id,
        id: `${unlockedWallet.id}_${lastReceivedHS.handshake.tx_id}`,
        fee: 0,
      });
    }

    console.log("saving", {
      kasiaHandshakeToPersist: kasiaHandshakesToPersist,
    });

    for (const kasiaHSToPersist of kasiaHandshakesToPersist) {
      try {
        await repositories.handshakeRepository.saveHandshake(kasiaHSToPersist);
      } catch (error) {
        console.error(
          "Messaging Store - Error while persisting handshake",
          error
        );
        continue;
      }

      oooc.events.push(kasiaHSToPersist);
    }

    oooc.events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    ooocsByAddress.set(senderAddress, oooc);
  };

  await Promise.allSettled([...uniqueSenderAddresses].map(processOneSender));

  repositories.metadataRepository.store({
    lastSavedHandshakeBlockTime: lastProcessedSavedHandshakeBlockTime,
    lastHandshakeBlockTime: lastProcessedHandhshakeBlockTime,
  });

  return {
    ooocsByAddress,
    resolvedUnknownReceivedHandshakesAliasesBySenderAddress,
  };
};
