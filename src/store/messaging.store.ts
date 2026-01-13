import { create } from "zustand";
import {
  KasiaConversationEvent,
  KasiaTransaction,
  OneOnOneConversation,
} from "../types/all";
import { Contact } from "./repository/contact.repository";
import {
  encrypt_message,
  EncryptedMessage,
  decrypt_message,
  PrivateKey,
} from "cipher";
import { WalletStorageService } from "../service/wallet-storage-service";
import {
  Address,
  decryptXChaCha20Poly1305,
  encryptXChaCha20Poly1305,
  kaspaToSompi,
} from "kaspa-wasm";
import { MIN_NETWORK_FEE } from "../config/constants";
import { ConversationManagerService } from "../service/conversation-manager-service";
import { useWalletStore } from "./wallet.store";
import { toast } from "../utils/toast-helper";
import {
  ConversationEvents,
  HandshakePayload,
  SavedHandshakePayload,
} from "src/types/messaging.types";
import { UnlockedWallet } from "src/types/wallet.type";
import { useDBStore } from "./db.store";
import {
  PendingConversation,
  ActiveConversation,
  Conversation,
} from "./repository/conversation.repository";
import { PROTOCOL, toHex } from "../config/protocol";
import { Payment } from "./repository/payment.repository";
import { Message } from "./repository/message.repository";
import { Handshake } from "./repository/handshake.repository";
import { HistoricalSyncer } from "../service/historical-syncer";
import { ContextualMessageResponse } from "../service/indexer/generated";
import { tryParseBase64AsHexToHex } from "../utils/payload-encoding";
import { hexToString } from "../utils/format";
import { RawResolvedKasiaTransaction } from "../service/block-processor-service";
import { Repositories } from "./repository/db";
import {
  BackupV2,
  exportData,
  importData,
} from "../service/import-export-service";
import { useNetworkStore } from "./network.store";
import { historicalLoader_loadSendAndReceivedHandshake } from "../utils/historical-loader";

interface MessagingState {
  isLoaded: boolean;
  isCreatingNewChat: boolean;
  eagerHistoricLoaded: boolean;
  lazyHistoricLoaded: boolean;
  oneOnOneConversations: OneOnOneConversation[];
  processingTransactionIds: Set<string>;
  ingestRawResolvedKasiaTransaction: (
    tx: RawResolvedKasiaTransaction
  ) => Promise<void>;
  storeKasiaTransactions: (transactions: KasiaTransaction[]) => Promise<void>;
  flushWalletHistory: (walletTenant: string) => Promise<void>;
  exportMessages: (wallet: UnlockedWallet, password: string) => Promise<Blob>;
  importMessages: (
    file: File,
    wallet: UnlockedWallet,
    password: string
  ) => Promise<void>;

  openedRecipient: string | null;
  setOpenedRecipient: (contact: string | null) => void;

  load: (address: string) => Promise<void>;
  stop: () => void;

  conversationManager: ConversationManagerService | null;
  initiateHandshake: (
    recipientAddress: string,
    customAmount?: bigint
  ) => Promise<void>;
  processHandshake: (
    senderAddress: string,
    payload: string
  ) => Promise<unknown>;
  getActiveConversationsWithContacts: () => {
    contact: Contact;
    conversation: ActiveConversation;
  }[];
  getConversationsWithContacts: () => {
    contact: Contact;
    conversation: Conversation;
  }[];
  getPendingConversationsWithContact: () => {
    contact: Contact;
    conversation: PendingConversation;
  }[];

  // New function to manually respond to a handshake
  respondToHandshake: (handshakeId: string) => Promise<string>;

  // Create offline handshake (aliases are now derived deterministically)
  /**
   * @deprecated Manual alias exchange is no longer needed. Aliases are derived deterministically.
   */
  createOffChainHandshake: (
    partnerAddress: string,
    ourAliasForPartner?: string,
    theirAliasForUs?: string
  ) => Promise<{ conversationId: string; contactId: string }>;

  // Generate unique alias for conversations
  generateUniqueAlias: () => string;

  // Create discrete conversation (no handshake required)
  createDiscreteConversation: (
    recipientAddress: string
  ) => Promise<{ conversationId: string; contactId: string }>;

  // Nickname management
  setContactNickname: (address: string, nickname?: string) => Promise<void>;
  removeContactNickname: (address: string) => Promise<void>;

  // self stash management
  createSelfStash: (handshakeData: {
    type: "initiation" | "response";
    partnerAddress: string;
    ourAlias: string;
    theirAlias?: string;
    isResponse?: boolean;
  }) => Promise<string>;

  // Hydration
  hydrateOneonOneConversations: () => Promise<void>;
}

export const useMessagingStore = create<MessagingState>((set, g) => {
  let _historicalSyncer: HistoricalSyncer = null!;

  const _isIncomingContentAllowed = (
    conversation: Conversation,
    isFromMe: boolean
  ): boolean => {
    if (isFromMe) return true;
    // Allow incoming messages if:
    // 1. Conversation is active, OR
    // 2. Conversation was initiated by me (e.g., discrete chat) - I explicitly chose to communicate
    return (
      Boolean(conversation.theirAlias) &&
      (conversation.status === "active" || conversation.initiatedByMe)
    );
  };

  const _fetchHistoricalForConversation = async (
    oooc: OneOnOneConversation,
    aliases: Set<string>,
    myAddress: string,
    repositories: Repositories
  ): Promise<void> => {
    try {
      if (!_historicalSyncer) return;
      const unlockedWallet = useWalletStore.getState().unlockedWallet;
      if (!unlockedWallet) return;

      const privateKeyString =
        WalletStorageService.getPrivateKey(unlockedWallet).toString();

      const aliasesToFetch = new Set<string>(aliases);
      if (!aliasesToFetch.size && oooc.conversation.theirAlias) {
        aliasesToFetch.add(oooc.conversation.theirAlias);
      }

      // get last message&payment timestamp
      const metadata = repositories.metadataRepository.load();
      const lastPaymentTimestamp = metadata.lastPaymentBlockTime;
      const lastMessageTimestamp = metadata.lastMessageBlockTime;

      const [indexerPayments, indexerMessages] = await Promise.all([
        _historicalSyncer.fetchHistoricalPaymentsFromAddress(
          oooc.contact.kaspaAddress,
          lastPaymentTimestamp
        ),
        Promise.allSettled(
          [...aliasesToFetch].map((alias) =>
            _historicalSyncer.fetchHistoricalMessagesToAddress(
              oooc.contact.kaspaAddress,
              alias,
              lastMessageTimestamp
            )
          )
        ).then((results) => {
          const fulfilled = results.filter(
            (r) => r.status === "fulfilled"
          ) as PromiseFulfilledResult<ContextualMessageResponse[]>[];
          return fulfilled.flatMap((r) => r.value);
        }),
      ]);

      const knownEventIds = new Set(oooc.events.map((e) => e.id.split("_")[1]));
      const newIndexerPayments = indexerPayments.filter(
        (p) => !knownEventIds.has(p.tx_id)
      );
      const newIndexerMessages = indexerMessages.filter(
        (m) => !knownEventIds.has(m.tx_id)
      );

      const newKasiaTransactions: KasiaTransaction[] = [];

      let lastProcessedMessageBlockTime = lastMessageTimestamp;
      let lastProcessedPaymentBlockTime = lastPaymentTimestamp;

      for (const m of newIndexerMessages) {
        try {
          const payload = m.message_payload;

          // if its base64, decrypt
          const encryptedHex = tryParseBase64AsHexToHex(payload);
          const encryptedMessage = new EncryptedMessage(encryptedHex);

          const decryptedContent = decrypt_message(
            encryptedMessage,
            new PrivateKey(privateKeyString)
          );

          const kasiaTransaction = {
            amount: 0,
            content: `${PROTOCOL.prefix.hex + PROTOCOL.headers.COMM.hex + hexToString(m.alias)}:${decryptedContent}`,
            createdAt: new Date(Number(m.block_time)),
            fee: 0,
            payload: payload,
            recipientAddress: myAddress,
            senderAddress: m.sender,
            transactionId: m.tx_id,
          };
          console.log("kasia transaction from message", { kasiaTransaction });
          newKasiaTransactions.push(kasiaTransaction);

          if (lastProcessedMessageBlockTime < Number(m.block_time)) {
            lastProcessedMessageBlockTime = Number(m.block_time);
          }
        } catch (error) {
          // chill
          console.error(error);
        }
      }

      for (const p of newIndexerPayments) {
        if (!p.sender) continue;
        try {
          const paymentPayload = decrypt_message(
            new EncryptedMessage(p.message),
            new PrivateKey(privateKeyString)
          );

          console.log("payment historical", {
            payload: p.message,
            decryptedPayload: paymentPayload,
          });
          newKasiaTransactions.push({
            amount: 0,
            content: paymentPayload,
            createdAt: new Date(Number(p.block_time)),
            fee: 0,
            payload:
              PROTOCOL.prefix.hex +
              PROTOCOL.headers.PAYMENT.hex +
              paymentPayload,
            recipientAddress: myAddress,
            senderAddress: p.sender,
            transactionId: p.tx_id,
          });

          if (lastProcessedPaymentBlockTime < Number(p.block_time)) {
            lastProcessedPaymentBlockTime = Number(p.block_time);
          }
        } catch {
          //nothing
        }
      }

      if (newKasiaTransactions.length > 0) {
        await g().storeKasiaTransactions(newKasiaTransactions);
      }

      // update last fetch timestamp
      repositories.metadataRepository.store({
        lastMessageBlockTime: lastProcessedMessageBlockTime,
        lastPaymentBlockTime: lastProcessedPaymentBlockTime,
      });
    } catch {
      // chill
    }
  };

  const _initializeConversationManager = async (address: string) => {
    const events: Partial<ConversationEvents> = {
      onHandshakeInitiated: (conversation, contact) => {
        console.log("Handshake initiated:", conversation);
        // You might want to update UI or state here
      },
      onHandshakeCompleted: (conversation, contact) => {
        console.log("Handshake completed:", conversation);
      },
      onHandshakeExpired: (conversation, contact) => {
        console.log("Handshake expired:", conversation);
        // You might want to update UI or state here
      },
      onError: (error) => {
        console.error("Conversation error:", error);
        // You might want to show error in UI
      },
    };

    const manager = await ConversationManagerService.init(
      address,
      useDBStore.getState().repositories,
      events
    );
    set({ conversationManager: manager });
  };

  return {
    isLoaded: false,
    isCreatingNewChat: false,
    eagerHistoricLoaded: false,
    lazyHistoricLoaded: false,
    openedRecipient: null,
    oneOnOneConversations: [],
    processingTransactionIds: new Set<string>(),
    async load(address) {
      const initLazyHistoricalHandshakeLoad = (
        lastSavedHanshakeTimestamp: number,
        lastHandshakeTimestamp: number
      ) => {
        _historicalSyncer = new HistoricalSyncer(address);

        const _handshakesPromise = _historicalSyncer.initialLoad(
          lastSavedHanshakeTimestamp,
          lastHandshakeTimestamp
        );

        const getHistoricalHandshakes = async () => {
          return await _handshakesPromise;
        };

        return getHistoricalHandshakes;
      };

      const repositories = useDBStore.getState().repositories;

      // 0. trigger lazy loading of historical handshakes

      console.log(
        "Loading Strategy - Getting last saved handshake and handshake..."
      );
      // get last date of handshakes

      const metadata = repositories.metadataRepository.load();
      const getHistoricalHandshakes = initLazyHistoricalHandshakeLoad(
        metadata.lastSavedHandshakeBlockTime,
        metadata.lastHandshakeBlockTime
      );

      console.log("Loading Strategy - Initializing Conversation Manager");

      // 1. initialize conversation manager that hydrate conversation with contacts
      await _initializeConversationManager(address);

      console.log("Loading Strategy - Hydrading OOC");

      // 2. hydrate events on these loaded conversations, this load in memory one on one conversation
      await g().hydrateOneonOneConversations();

      console.log("Loading Strategy - Waiting for histical upsteam response");

      // 3. process historical saved handshakes (that were lazily loaded), this will create new conversations locally if needed
      //   AND
      // 4. process historical handshakes (that were lazily loaded), this will create new conversations locally if needed
      const conversationManager = g().conversationManager;

      if (conversationManager) {
        try {
          const {
            ooocsByAddress,
            resolvedUnknownReceivedHandshakesAliasesBySenderAddress,
          } = await historicalLoader_loadSendAndReceivedHandshake(
            repositories,
            getHistoricalHandshakes,
            g().oneOnOneConversations,
            conversationManager,
            metadata
          );

          console.log(
            "Loading Strategy - handshake history reconciliation loaded"
          );

          set({
            oneOnOneConversations: Array.from(ooocsByAddress.values()),
            eagerHistoricLoaded: true,
          });

          // 5. lazily trigger historical polling of events for each conversation
          console.log(
            "Lazy historical polling of events for each conversation"
          );

          Promise.allSettled(
            Array.from(ooocsByAddress.values()).map(async (oooc) => {
              // optimization possibility: fetch only events that are after last known conversation event

              // also included previously unknown handhshakes message history fetching
              // this is useful mainly on a new device, where we have no history of received messages

              // include current conversation participant's alias
              const resolvedUnknownHandshakesAlisesForThisConversation =
                resolvedUnknownReceivedHandshakesAliasesBySenderAddress[
                  oooc.contact.kaspaAddress
                ] ?? new Set<string>();
              if (oooc.conversation.theirAlias) {
                resolvedUnknownHandshakesAlisesForThisConversation.add(
                  oooc.conversation.theirAlias
                );
              }

              return _fetchHistoricalForConversation(
                oooc,
                resolvedUnknownHandshakesAlisesForThisConversation,
                address,
                repositories
              );
            })
          ).then(() => {
            set({ lazyHistoricLoaded: true });
          });

          set({
            isLoaded: true,
          });
        } catch (error) {
          console.error(error);

          set({ isLoaded: true });
          return;
        }
      }
    },
    stop() {
      _historicalSyncer = null!;
    },
    hydrateOneonOneConversations: async () => {
      const repositories = useDBStore.getState().repositories;

      const conversationWithContacts =
        g().conversationManager?.getAllConversationsWithContact();

      if (!conversationWithContacts) {
        return;
      }

      const oneOnOneConversationPromises = conversationWithContacts.map(
        async ({
          contact,
          conversation,
        }): Promise<OneOnOneConversation | null> => {
          const events = await repositories.getKasiaEventsByConversationId(
            conversation.id
          );

          return { conversation, contact, events };
        }
      );
      const oneOnOneConversations = await Promise.all(
        oneOnOneConversationPromises
      );
      const filteredConversations = oneOnOneConversations.filter(
        (c) => c !== null
      );
      set({
        oneOnOneConversations: filteredConversations,
      });
    },
    storeKasiaTransactions: async (transactions) => {
      // Update contacts with new messages
      const state = g();
      const walletStore = useWalletStore.getState();
      const unlockedWallet = walletStore.unlockedWallet;
      const repositories = useDBStore.getState().repositories;

      if (!unlockedWallet) {
        throw new Error("Wallet is not unlocked");
      }

      // cannot use `walletStore.address` because it is not always already populated
      const address = WalletStorageService.getPrivateKey(unlockedWallet)
        .toAddress(useWalletStore.getState().selectedNetwork)
        .toString();

      if (!address) {
        throw new Error("Address is not available");
      }

      // In-memory deduplication to prevent concurrent processing of the same transaction
      for (const transaction of transactions) {
        const transactionId = transaction.transactionId;

        // Check if this transaction is already being processed
        if (g().processingTransactionIds.has(transactionId)) {
          console.warn(
            `Skipping transaction already in processing: ${transactionId}`
          );
          continue;
        }
        set((state) => ({
          processingTransactionIds: new Set([
            ...state.processingTransactionIds,
            transactionId,
          ]),
        }));

        try {
          const isFromMe = transaction.senderAddress === address.toString();
          const participantAddress = isFromMe
            ? transaction.recipientAddress
            : transaction.senderAddress;

          if (
            await repositories.doesKasiaEventExistsById(
              `${unlockedWallet.id}_${transaction.transactionId}`
            )
          ) {
            console.warn(
              "Skipping already processed transaction: ",
              transaction.transactionId
            );
            continue;
          }

          console.log("Processing transaction: ", {
            ...transaction,
            isFromMe,
            participantAddress,
          });

          // HANDSHAKE
          if (
            transaction.content.startsWith(PROTOCOL.prefix.string) &&
            transaction.content.includes(":handshake:")
          ) {
            try {
              // Parse the handshake payload
              const parts = transaction.content.split(":");
              const jsonPart = parts.slice(3).join(":");
              const handshakePayload = JSON.parse(jsonPart);

              // Skip handshake processing if it's a self-message
              if (
                transaction.senderAddress === address.toString() &&
                transaction.recipientAddress === address.toString()
              ) {
                console.log("Skipping self-handshake message");
                continue;
              }

              if (
                // received handshake
                transaction.recipientAddress === address.toString()
              ) {
                // Check if this handshake has already been processed
                const handshakeId = `${unlockedWallet.id}_${transaction.transactionId}`;

                const handshakeExists = await repositories.handshakeRepository
                  .doesExistsById(handshakeId)
                  .catch(() => false);

                if (handshakeExists) {
                  console.warn(
                    `Skipping already processed handshake: ${handshakeId}`
                  );
                  continue;
                }

                console.log("Processing handshake message:", {
                  senderAddress: transaction.senderAddress,
                  recipientAddress: transaction.recipientAddress,
                  isResponse: handshakePayload.isResponse,
                  handshakePayload,
                });
                await g()
                  .processHandshake(
                    transaction.senderAddress,
                    transaction.content
                  )
                  .catch((error) => {
                    if (
                      error.message === "Cannot create conversation with self"
                    ) {
                      console.log("Skipping self-conversation handshake");
                      return;
                    }
                    console.error("Error processing handshake:", error);
                  });

                const conversationWithContact =
                  g().conversationManager?.getConversationWithContactByAddress(
                    transaction.senderAddress
                  );

                // persist in-memory & db kasia events
                if (conversationWithContact) {
                  const handshake: Handshake = {
                    __type: "handshake",
                    amount: transaction.amount,
                    contactId: conversationWithContact.contact.id,
                    content: transaction.content,
                    conversationId: conversationWithContact.conversation.id,
                    createdAt: transaction.createdAt,
                    fromMe: isFromMe,
                    id: `${unlockedWallet.id}_${transaction.transactionId}`,
                    tenantId: unlockedWallet.id,
                    transactionId: transaction.transactionId,
                    fee: transaction.fee,
                  };
                  await repositories.handshakeRepository.saveHandshake(
                    handshake
                  );

                  // if already exists in memory, add even in place else add new one on one conversation
                  const existingConversationIndex =
                    g().oneOnOneConversations.findIndex(
                      (c) =>
                        c.conversation.id ===
                        conversationWithContact.conversation.id
                    );

                  if (existingConversationIndex !== -1) {
                    const updatedConversations = [...g().oneOnOneConversations];
                    updatedConversations[existingConversationIndex] = {
                      ...updatedConversations[existingConversationIndex],
                      conversation: conversationWithContact.conversation,
                      events: [
                        ...updatedConversations[existingConversationIndex]
                          .events,
                        handshake,
                      ],
                    };
                    set({ oneOnOneConversations: updatedConversations });
                  } else {
                    set({
                      oneOnOneConversations: [
                        ...g().oneOnOneConversations,
                        {
                          contact: conversationWithContact.contact,
                          events: [handshake],
                          conversation: conversationWithContact.conversation,
                        },
                      ],
                    });
                  }
                }
                continue;
              }
            } catch (error) {
              console.error("Error processing handshake message:", error);
              throw error;
            }
          }

          // SELF STASH - SAVED HANDSHAKE
          if (
            transaction.content.startsWith(PROTOCOL.prefix.string) &&
            transaction.content.includes(":handshake:")
          ) {
            // prefix:1:self_stash[:optional_scope]:data
            const parts = transaction.content.split(":");

            const hasSavedHandshakeScope = parts[3] === "saved_handshake";

            if (!hasSavedHandshakeScope) {
              continue;
            }

            try {
              const payload: SavedHandshakePayload = JSON.parse(parts[4]);

              await g().conversationManager?.hydrateFromSavedHanshaked(
                payload,
                transaction.transactionId
              );

              const conversationWithContact =
                g().conversationManager?.getConversationWithContactByAddress(
                  transaction.senderAddress
                );

              if (conversationWithContact) {
                const handshake: Handshake = {
                  __type: "handshake",
                  amount: transaction.amount,
                  contactId: conversationWithContact.contact.id,
                  conversationId: conversationWithContact.conversation.id,
                  content: "Handshake sent",
                  fromMe: true,
                  createdAt: transaction.createdAt,
                  tenantId: unlockedWallet.id,
                  transactionId: transaction.transactionId,
                  id: `${unlockedWallet.id}_${transaction.transactionId}`,
                  fee: 0,
                };

                // if already exists in memory, add even in place else add new one on one conversation
                const existingConversationIndex =
                  g().oneOnOneConversations.findIndex(
                    (c) =>
                      c.conversation.id ===
                      conversationWithContact.conversation.id
                  );

                if (existingConversationIndex !== -1) {
                  const updatedConversations = [...g().oneOnOneConversations];
                  updatedConversations[existingConversationIndex] = {
                    ...updatedConversations[existingConversationIndex],
                    conversation: conversationWithContact.conversation,
                    events: [
                      ...updatedConversations[existingConversationIndex].events,
                      handshake,
                    ],
                  };
                  set({ oneOnOneConversations: updatedConversations });
                } else {
                  set({
                    oneOnOneConversations: [
                      ...g().oneOnOneConversations,
                      {
                        contact: conversationWithContact.contact,
                        events: [handshake],
                        conversation: conversationWithContact.conversation,
                      },
                    ],
                  });
                }

                console.log("saving", { handshake });

                await repositories.handshakeRepository.saveHandshake(handshake);
              }
            } catch (error) {
              console.error(`Error while handling saved handshake`, error);
              continue;
            }
            continue;
          }

          const existingConversationWithContactIndex =
            state.oneOnOneConversations.findIndex(
              (c) => c.contact.kaspaAddress === participantAddress
            );

          if (existingConversationWithContactIndex === -1) {
            throw new Error("Conversation not found, ignoring message");
          }

          const existingConversationWithContact =
            state.oneOnOneConversations[existingConversationWithContactIndex];

          const isTransactionAlreadyIngested =
            existingConversationWithContact.events.some(
              (e) => e.transactionId === transaction.transactionId
            );

          if (isTransactionAlreadyIngested) {
            console.warn("Transaction already ingested, ignoring message");
            return;
          }

          let kasiaEvent: KasiaConversationEvent | null = null;

          // PAYMENT
          if (
            transaction.payload.startsWith(PROTOCOL.prefix.hex) &&
            transaction.payload.includes(PROTOCOL.headers.PAYMENT.hex)
          ) {
            let paymentContent = transaction.content ?? "";
            if (
              !_isIncomingContentAllowed(
                existingConversationWithContact.conversation,
                isFromMe
              )
            ) {
              // drop note for incoming payments if not accepted/alias unknown
              try {
                const parsed = JSON.parse(paymentContent);
                if (parsed && parsed.type === PROTOCOL.headers.PAYMENT.type) {
                  delete parsed.message;
                  paymentContent = JSON.stringify(parsed);
                }
              } catch {
                paymentContent = "";
              }
            }
            const payment: Payment = {
              __type: "payment",
              amount: transaction.amount,
              contactId: existingConversationWithContact.contact.id,
              conversationId: existingConversationWithContact.conversation.id,
              content: paymentContent,
              createdAt: transaction.createdAt,
              fromMe: transaction.senderAddress === address.toString(),
              id: `${unlockedWallet.id}_${transaction.transactionId}`,
              tenantId: unlockedWallet.id,
              transactionId: transaction.transactionId,
              fee: transaction.fee,
            };

            await repositories.paymentRepository.savePayment(payment);

            kasiaEvent = payment;
          }

          if (
            transaction.content.startsWith(PROTOCOL.prefix.hex) &&
            transaction.content.includes(PROTOCOL.headers.COMM.hex)
          ) {
            // block incoming messages unless conversation is accepted and alias known
            if (
              !_isIncomingContentAllowed(
                existingConversationWithContact.conversation,
                isFromMe
              )
            ) {
              continue;
            }
            const decryptedContent = transaction.content.substring(
              transaction.content.indexOf(":") + 1
            );

            const message: Message = {
              __type: "message",
              amount: transaction.amount,
              contactId: existingConversationWithContact.contact.id,
              conversationId: existingConversationWithContact.conversation.id,
              content: decryptedContent ?? "",
              createdAt: transaction.createdAt,
              fromMe: transaction.senderAddress === address.toString(),
              id: `${unlockedWallet.id}_${transaction.transactionId}`,
              tenantId: unlockedWallet.id,
              transactionId: transaction.transactionId,
              fee: transaction.fee,
            };

            await repositories.messageRepository.saveMessage(message);

            kasiaEvent = message;
          }

          // touch conversation last activity
          await repositories.conversationRepository.updateLastActivity(
            existingConversationWithContact.conversation.id,
            transaction.createdAt
          );

          if (!kasiaEvent) {
            continue;
          }

          set((state) => {
            const updatedConversationWithContacts = [
              ...state.oneOnOneConversations,
            ];

            const ooocToUpdateIndex = state.oneOnOneConversations.findIndex(
              (oooc) => oooc.contact.kaspaAddress === participantAddress
            );

            if (ooocToUpdateIndex === -1) {
              console.log("ooocToUpdateIndex not found", participantAddress);
              return state;
            }

            // Check if this event already exists to prevent duplicates
            const existingEventIndex = state.oneOnOneConversations[
              ooocToUpdateIndex
            ].events.findIndex(
              (event) => event.transactionId === kasiaEvent.transactionId
            );

            const updatedConversation = {
              ...state.oneOnOneConversations[ooocToUpdateIndex],
              conversation: {
                ...state.oneOnOneConversations[ooocToUpdateIndex].conversation,
                lastActivityAt: transaction.createdAt,
              },
              events:
                existingEventIndex === -1
                  ? [
                      ...state.oneOnOneConversations[ooocToUpdateIndex].events,
                      kasiaEvent,
                    ].sort(
                      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
                    )
                  : state.oneOnOneConversations[ooocToUpdateIndex].events, // Event already exists, don't add duplicate
            };

            updatedConversationWithContacts[ooocToUpdateIndex] =
              updatedConversation;

            console.log(
              "updatedConversationWithContacts",
              updatedConversationWithContacts
            );

            return { oneOnOneConversations: updatedConversationWithContacts };
          });
        } finally {
          // remove transaction ID from processing set
          set((state) => {
            const newSet = new Set(state.processingTransactionIds);
            newSet.delete(transactionId);
            return { processingTransactionIds: newSet };
          });
        }
      }
    },
    flushWalletHistory: async (walletTenant: string) => {
      // 1. Clear wallet messages from localStorage using new per-address system
      const walletStore = useWalletStore.getState();
      const unlockedWallet = walletStore.unlockedWallet;

      if (!unlockedWallet) {
        console.error("Wallet is not unlocked for flushing history.");
        return;
      }

      const network = useNetworkStore.getState().network;

      const receiveAddress = unlockedWallet.receivePublicKey
        .toAddress(network)
        .toString();

      // 1. Clear last opened contact for this wallet
      localStorage.removeItem(`kasia_last_opened_contact_${walletTenant}`);

      // 2. Remove all IndexDB related to this tenant
      const repositories = useDBStore.getState().repositories;

      await Promise.all([
        repositories.paymentRepository.deleteTenant(walletTenant),
        repositories.broadcastChannelRepository.deleteTenant(walletTenant),
        repositories.contactRepository.deleteTenant(walletTenant),
        repositories.decryptionTrialRepository.deleteTenant(walletTenant),
        repositories.handshakeRepository.deleteTenant(walletTenant),
        repositories.messageRepository.deleteTenant(walletTenant),
        repositories.savedHandshakeRepository.deleteTenant(walletTenant),
      ]);

      // 3. Reset metadata
      repositories.metadataRepository.erase();

      // 4. Reset all UI state immediately
      set({
        oneOnOneConversations: [],
        openedRecipient: null,
        isCreatingNewChat: false,
      });

      // 5. Clear and reinitialize conversation manager
      const manager = g().conversationManager;
      if (manager) {
        // Reinitialize fresh conversation manager
        _initializeConversationManager(receiveAddress);
      }

      console.log("Complete history clear completed - all data wiped");
    },
    setOpenedRecipient(contact) {
      set({ openedRecipient: contact });
    },
    exportMessages: async (wallet, password) => {
      const backup = await exportData(useDBStore.getState().repositories);

      const encryptedBackup = encryptXChaCha20Poly1305(
        JSON.stringify(backup),
        password
      );

      const blob = new Blob([encryptedBackup], {
        type: "application/json",
      });

      return blob;
    },
    importMessages: async (file, wallet, password) => {
      const fileContent = await file.text();

      const decryptedBackup = decryptXChaCha20Poly1305(fileContent, password);

      const backup: BackupV2 = JSON.parse(decryptedBackup);

      await importData(useDBStore.getState().repositories, backup);

      await g()?.conversationManager?.loadConversations();
      await g().hydrateOneonOneConversations();
    },
    conversationManager: null,
    initiateHandshake: async (
      recipientAddress: string,
      customAmount?: bigint
    ) => {
      const manager = g().conversationManager;
      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      // Get the wallet store for sending the message
      const walletStore = useWalletStore.getState();
      if (!walletStore.unlockedWallet || !walletStore.address) {
        throw new Error("Wallet not unlocked");
      }

      // create contact and conversation
      const { contact, conversation } =
        await manager.initiateHandshake(recipientAddress);

      // Create the handshake payload (aliases no longer exchanged - they're derived deterministically)
      const handshakePayload: HandshakePayload = {
        type: "handshake",
        timestamp: Date.now(),
        version: 1,
      };

      console.log(
        "[initiateHandshake] Conversation aliases => myAlias:",
        conversation.myAlias,
        "theirAlias:",
        conversation.theirAlias
      );

      // their payload
      const encryptedMessageForThem = encrypt_message(
        recipientAddress,
        JSON.stringify(handshakePayload)
      );

      const theirPayload = `${toHex("ciph_msg:1:handshake:")}${encryptedMessageForThem.to_hex()}`;

      // Send the handshake message
      console.log("Sending handshake message to:", recipientAddress);
      try {
        const theirTxId = await walletStore.sendTransaction({
          payload: theirPayload,
          toAddress: new Address(recipientAddress),
          password: walletStore.unlockedWallet.password,
          customAmount,
        });

        console.log("Handshake message sent, transaction ID:", theirTxId);

        // Create a message object for the handshake
        const kasiaTransaction: KasiaTransaction = {
          transactionId: theirTxId,
          senderAddress: walletStore.address.toString(),
          recipientAddress: recipientAddress,
          createdAt: new Date(),
          // @TODO(indexdb): fix this to use the correct fee
          fee: 0,
          content: "Handshake initiated",
          amount: Number(customAmount || 20000000n) / 100000000, // Convert bigint to KAS number
          payload: theirPayload,
        };

        const handshake: Handshake = {
          __type: "handshake",
          id: `${walletStore.unlockedWallet.id}_${theirTxId}`,
          tenantId: walletStore.unlockedWallet.id,
          amount: kasiaTransaction.amount,
          contactId: contact.id,
          conversationId: conversation.id,
          content: kasiaTransaction.content,
          createdAt: kasiaTransaction.createdAt,
          fromMe: true,
          transactionId: kasiaTransaction.transactionId,
          fee: kasiaTransaction.fee,
        };

        const repositories = useDBStore.getState().repositories;

        await repositories.handshakeRepository.saveHandshake(handshake);

        const oneOnOneConversations = g().oneOnOneConversations;

        // push at the beginning of the array
        oneOnOneConversations.unshift({
          conversation,
          contact,
          events: [handshake],
        });

        set({
          oneOnOneConversations,
        });

        // create self-stash for handshake initiation
        const selfStashTxId = await g().createSelfStash({
          type: "initiation",
          partnerAddress: recipientAddress,
          ourAlias: conversation.myAlias,
        });

        console.log("Handshake initiation self-stash created:", selfStashTxId);
      } catch (error) {
        console.error("Error sending handshake message:", error);
        throw error;
      }
    },
    processHandshake: async (senderAddress: string, payload: string) => {
      const manager = g().conversationManager;
      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      const validatedPayload: HandshakePayload =
        manager.parseHandshakePayload(payload);

      const result = await manager.processHandshake(
        senderAddress,
        validatedPayload
      );

      // If the result indicates we should send an automatic response (e.g., for existing active conversations)
      if (
        result &&
        typeof result === "object" &&
        "shouldSendResponse" in result &&
        "conversationId" in result
      ) {
        const typedResult = result as {
          shouldSendResponse: boolean;
          conversationId: string;
        };
        if (typedResult.shouldSendResponse) {
          console.log(
            "[processHandshake] Automatically sending handshake response for conversation:",
            typedResult.conversationId
          );
          try {
            // Send automatic response transaction
            const walletStore = useWalletStore.getState();
            const repositories = useDBStore.getState().repositories;

            if (!walletStore.unlockedWallet?.password || !walletStore.address) {
              console.error(
                "[processHandshake] Cannot send automatic response - wallet not unlocked"
              );
              return result;
            }

            const conversation =
              await repositories.conversationRepository.getConversation(
                typedResult.conversationId
              );
            const contact = await repositories.contactRepository.getContact(
              conversation.contactId
            );

            // Create handshake response (updates conversation status to active if needed)
            await manager.createHandshakeResponse(conversation.id);

            // Build handshake response payload
            const handshakeResponsePayload: HandshakePayload = {
              type: "handshake",
              timestamp: Date.now(),
              version: 1,
              isResponse: true,
            };

            const payload = `${toHex("ciph_msg:1:handshake:")}${encrypt_message(contact.kaspaAddress, JSON.stringify(handshakeResponsePayload)).to_hex()}`;

            // Send the handshake response transaction
            const txId = await walletStore.sendTransaction({
              payload,
              toAddress: new Address(contact.kaspaAddress),
              password: walletStore.unlockedWallet.password,
              customAmount: kaspaToSompi("0.2"),
            });

            console.log(
              "[processHandshake] Automatic handshake response sent, txId:",
              txId
            );

            // Save handshake event
            const eventToAdd: Handshake = {
              __type: "handshake",
              amount: 0.2,
              contactId: contact.id,
              conversationId: conversation.id,
              content: "Automatic handshake response",
              createdAt: new Date(),
              fromMe: true,
              id: `${walletStore.unlockedWallet.id}_${txId}`,
              tenantId: walletStore.unlockedWallet.id,
              transactionId: txId,
              fee: 0,
            };

            await repositories.handshakeRepository.saveHandshake(eventToAdd);
          } catch (error) {
            console.error(
              "[processHandshake] Failed to send automatic response:",
              error
            );
          }
        }
      }

      return result;
    },
    getActiveConversationsWithContacts: () => {
      const manager = g().conversationManager;
      return manager ? manager.getActiveConversationsWithContact() : [];
    },
    getConversationsWithContacts: () => {
      const manager = g().conversationManager;
      return manager ? manager.getAllConversationsWithContact() : [];
    },
    getPendingConversationsWithContact: () => {
      const manager = g().conversationManager;
      return manager ? manager.getPendingConversationsWithContact() : [];
    },

    /**
     * @deprecated Manual alias exchange is no longer needed. Aliases are derived deterministically.
     */
    createOffChainHandshake: async (
      partnerAddress: string,
      _ourAliasForPartner?: string,
      _theirAliasForUs?: string
    ) => {
      const manager = g().conversationManager;
      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      // Call the service method (aliases are now derived, not provided)
      const result = await manager.createOffChainHandshake(partnerAddress);

      // Refresh the UI state to trigger re-render with the new contact
      await g().hydrateOneonOneConversations();

      return result;
    },

    generateUniqueAlias: () => {
      const manager = g().conversationManager;

      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      return manager.generateUniqueAlias();
    },

    createDiscreteConversation: async (recipientAddress: string) => {
      const manager = g().conversationManager;
      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      const repositories = useDBStore.getState().repositories;
      const walletStore = useWalletStore.getState();

      if (!walletStore.unlockedWallet) {
        throw new Error("Wallet not unlocked");
      }

      // Create discrete conversation (no handshake required)
      const { conversation, contact } =
        await manager.createDiscreteConversation(recipientAddress);

      console.log(
        "[createDiscreteConversation] Created discrete conversation with",
        recipientAddress
      );
      console.log(
        "[createDiscreteConversation] Aliases => myAlias:",
        conversation.myAlias,
        "theirAlias:",
        conversation.theirAlias
      );

      // Create an off-chain system message to mark the start of the discrete conversation
      const systemMessage: Message = {
        __type: "message",
        id: `${walletStore.unlockedWallet.id}_discrete_start_${conversation.id}`,
        conversationId: conversation.id,
        contactId: contact.id,
        content:
          "Discrete chat initiated. Messages will only be received if the other party is monitoring your address (via their own discrete chat or an existing conversation).",
        amount: 0,
        fromMe: true,
        createdAt: new Date(),
        tenantId: walletStore.unlockedWallet.id,
        transactionId: `discrete_start_${conversation.id}`,
        fee: 0,
      };

      // Save the system message locally
      await repositories.messageRepository.saveMessage(systemMessage);

      console.log(
        "[createDiscreteConversation] Created system message:",
        systemMessage.id
      );

      // Optionally create self-stash for cross-device sync (requires minimal funds for network fees)
      // Check if user has sufficient balance before attempting
      const minFeeAmount = MIN_NETWORK_FEE;
      const currentBalance = walletStore.balance;

      if (currentBalance && currentBalance.mature >= minFeeAmount) {
        try {
          const selfStashTxId = await g().createSelfStash({
            type: "initiation",
            partnerAddress: recipientAddress,
            ourAlias: conversation.myAlias,
            theirAlias: conversation.theirAlias ?? undefined,
          });

          console.log(
            "[createDiscreteConversation] Self-stash created for cross-device sync:",
            selfStashTxId
          );
        } catch (error) {
          console.warn(
            "[createDiscreteConversation] Failed to create self-stash (conversation still works locally):",
            error instanceof Error ? error.message : error
          );
        }
      } else {
        console.log(
          "[createDiscreteConversation] Skipping self-stash - insufficient balance for network fees (conversation works locally)"
        );
        toast.warning(
          "Chat created locally only. Insufficient balance for cross-device sync. Chat history won't be available on other devices.",
          8000
        );
      }

      // Refresh the UI state to show the new conversation
      await g().hydrateOneonOneConversations();

      return {
        conversationId: conversation.id,
        contactId: contact.id,
      };
    },

    respondToHandshake: async (handshakeId: string) => {
      try {
        const repositories = useDBStore.getState().repositories;

        const manager = g().conversationManager;
        if (!manager) {
          throw new Error("Conversation manager not initialized");
        }

        // Get wallet info
        const walletStore = useWalletStore.getState();
        if (!walletStore.unlockedWallet?.password || !walletStore.address) {
          throw new Error("Wallet not unlocked");
        }

        const handshake =
          await repositories.handshakeRepository.getHandshake(handshakeId);

        console.log("Responding to handshake:", { handshake });

        const [contact, conversation] = await Promise.all([
          repositories.contactRepository.getContact(handshake.contactId),
          repositories.conversationRepository.getConversation(
            handshake.conversationId
          ),
        ]);

        const recipientAddress = contact.kaspaAddress;

        console.log("Using recipient address:", recipientAddress);

        // Create handshake response
        await manager.createHandshakeResponse(conversation.id);

        // Aliases are no longer exchanged - they're derived deterministically
        const handshakeResponsePayload: HandshakePayload = {
          type: "handshake",
          timestamp: Date.now(),
          version: 1,
          isResponse: true,
        };

        console.log("Handshake response to send:", handshakeResponsePayload);
        console.log(
          "[respondToHandshake] Conversation aliases => myAlias:",
          conversation.myAlias,
          "theirAlias:",
          conversation.theirAlias
        );

        const payload = `${toHex("ciph_msg:1:handshake:")}${encrypt_message(recipientAddress, JSON.stringify(handshakeResponsePayload)).to_hex()}`;

        try {
          const kaspaAddress = new Address(recipientAddress);

          // Send the handshake response
          const txId = await walletStore.sendTransaction({
            payload,
            toAddress: kaspaAddress,
            password: walletStore.unlockedWallet.password,
            customAmount: kaspaToSompi("0.2"),
          });

          // Update the handshake status in the store
          const updatedConversation = manager
            .getActiveConversationsWithContact()
            .find((oooc) => oooc.conversation.id === conversation.id);

          if (!updatedConversation) {
            console.error("Failed to find updated conversation");
            throw new Error("Failed to find updated conversation");
          }

          const eventToAdd: Handshake = {
            __type: "handshake",
            amount: 0.2,
            contactId: contact.id,
            conversationId: conversation.id,
            content: "Handshake response sent",
            createdAt: new Date(),
            fromMe: true,
            id: `${walletStore.unlockedWallet.id}_${txId}`,
            tenantId: walletStore.unlockedWallet.id,
            transactionId: txId,
            fee: 0,
          };

          await repositories.handshakeRepository.saveHandshake(eventToAdd);

          // create self-stash for handshake response
          const selfStashTxId = await g().createSelfStash({
            type: "response",
            partnerAddress: recipientAddress,
            ourAlias: conversation.myAlias,
            theirAlias: conversation.theirAlias!,
            isResponse: true,
          });

          console.log("Handshake response self-stash created:", selfStashTxId);

          const updatedOneOnOneConversations = g().oneOnOneConversations.map(
            (oooc): OneOnOneConversation => {
              if (oooc.conversation.id === conversation.id) {
                return {
                  contact: oooc.contact,
                  conversation: updatedConversation.conversation,
                  events: [...oooc.events, eventToAdd].sort(
                    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
                  ),
                };
              }
              return oooc;
            }
          );

          if (updatedConversation) {
            set({
              oneOnOneConversations: updatedOneOnOneConversations,
            });
          }

          // after successful response, trigger a one-time indexer backfill for this conversation
          try {
            const walletStoreState = useWalletStore.getState();
            const myAddress = walletStoreState.address?.toString();
            if (myAddress) {
              const oooc = g().oneOnOneConversations.find(
                (o) => o.conversation.id === conversation.id
              );
              if (oooc) {
                const aliases = new Set<string>();
                if (oooc.conversation.theirAlias) {
                  aliases.add(oooc.conversation.theirAlias);
                }
                await _fetchHistoricalForConversation(
                  oooc,
                  aliases,
                  myAddress,
                  repositories
                );
              }
            }
          } catch (e) {
            console.warn(
              "failed to backfill messages after handshake response",
              e
            );
          }

          return txId;
        } catch (error: unknown) {
          console.error("Error creating Kaspa address:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Invalid Kaspa address format: ${errorMessage}`);
        }
      } catch (error: unknown) {
        console.error("Error sending handshake response:", error);
        throw error;
      }
    },

    // Nickname management functions
    setContactNickname: async (address: string, nickname?: string) => {
      const oneOnOneConversationIndex = g().oneOnOneConversations.findIndex(
        (oooc) => oooc.contact.kaspaAddress === address
      );

      if (oneOnOneConversationIndex === -1) {
        throw new Error("Conversation not found");
      }

      const copiedOneOnOneConversations = [...g().oneOnOneConversations];

      copiedOneOnOneConversations[oneOnOneConversationIndex] = {
        ...copiedOneOnOneConversations[oneOnOneConversationIndex],
        contact: {
          ...copiedOneOnOneConversations[oneOnOneConversationIndex].contact,
          name: nickname?.trim(),
        },
      };

      set({ oneOnOneConversations: copiedOneOnOneConversations });

      await useDBStore.getState().repositories.contactRepository.saveContact({
        ...copiedOneOnOneConversations[oneOnOneConversationIndex].contact,
        name: nickname?.trim(),
      });
    },

    removeContactNickname: async (address: string) => {
      return g().setContactNickname(address, undefined);
    },

    async ingestRawResolvedKasiaTransaction(tx) {
      // note: ideally we wouldn't have "too much" cross-store dependency
      // or at least in a determined way that would prevent bi-directional dependencies
      const unlockedWallet = useWalletStore.getState().unlockedWallet;

      if (!unlockedWallet) {
        throw new Error(
          "Cannot process live transaction because wallet isn't initialized."
        );
      }

      const privateKey = WalletStorageService.getPrivateKey(unlockedWallet);

      const decryptedContent = decrypt_message(
        new EncryptedMessage(tx.parsedPayload.encryptedHex),
        new PrivateKey(privateKey.toString())
      );
      // this hack is necessary because we have inconsistencies between data parsed at historical level
      // , at live level (here is live level), and when client is the creator of the event
      // so be "re-build" it like the other places, ideally this shouldn't be necessary
      let hackedContent = decryptedContent;

      if (tx.parsedPayload.type === "handshake") {
        // handhshake payload is expected to be utf-8 encoded
        hackedContent = `${PROTOCOL.prefix.string}${PROTOCOL.headers.HANDSHAKE.string}${decryptedContent}`;
      } else if (tx.parsedPayload.type === "comm") {
        // message payload is expected to be hex encoded
        hackedContent = `${PROTOCOL.prefix.hex}${PROTOCOL.headers.COMM.hex}${toHex(tx.parsedPayload.alias ?? "UNKNOWN")}:${decryptedContent}`;
      } else if (tx.parsedPayload.type === "payment") {
        // payment payload should be the raw decrypted JSON content
        hackedContent = decryptedContent;
      } else if (tx.parsedPayload.type === "self_stash") {
        // self_stash payload is expected to be hex encoded
        hackedContent = `${PROTOCOL.prefix.hex}${PROTOCOL.headers.SELF_STASH.hex}${tx.parsedPayload.scope ? `${toHex(tx.parsedPayload.scope)}:` : ""}${decryptedContent}`;
      }

      const kasiaTransaction: KasiaTransaction = {
        transactionId: tx.id,
        senderAddress: tx.senderAddressString,
        recipientAddress: tx.recipientAddressString,
        createdAt: new Date(Number(tx.header.timestamp)),
        // TODO: gas only is additional fees and not base fees based on mass?
        fee: 0, // Number(tx.transaction.gas),
        content: hackedContent,
        amount: Number(tx.recipientOutputAmount),
        payload: tx.transaction.payload,
      };

      await g().storeKasiaTransactions([kasiaTransaction]);
    },

    // create a self stash transaction to backup handshake data on-chain
    async createSelfStash(handshakeData: {
      type: "initiation" | "response";
      partnerAddress: string;
      ourAlias: string;
      theirAlias?: string;
      isResponse?: boolean;
    }): Promise<string> {
      const walletStore = useWalletStore.getState();
      const repositories = useDBStore.getState().repositories;

      if (!walletStore.unlockedWallet) {
        throw new Error("Wallet not unlocked");
      }

      if (!walletStore.accountService) {
        throw new Error("Account service not available");
      }

      // check if user has sufficient funds for network fees (not 0.2 KAS like handshakes)
      const minFeeAmount = MIN_NETWORK_FEE;
      const currentBalance = walletStore.balance;
      if (!currentBalance || currentBalance.mature < minFeeAmount) {
        throw new Error(
          "Insufficient funds. You need at least ~0.2 KAS for network fees to create self-stash."
        );
      }

      // get our own address for encryption and transaction
      const address = WalletStorageService.getPrivateKey(
        walletStore.unlockedWallet
      )
        .toAddress(walletStore.selectedNetwork)
        .toString();

      // create the payload for self stash (extend the standard handshake payload)
      const basePayload: HandshakePayload = {
        type: "handshake",
        alias: handshakeData.ourAlias,
        timestamp: Date.now(),
        version: 1,
        ...(handshakeData.theirAlias && {
          theirAlias: handshakeData.theirAlias,
        }),
        ...(handshakeData.isResponse && { isResponse: true }),
      };

      // create extended payload for self-stash storage
      const payload = {
        ...basePayload,
        partnerAddress: handshakeData.partnerAddress,
        recipientAddress: handshakeData.partnerAddress,
      };

      const encryptedMessage = encrypt_message(
        address,
        JSON.stringify(payload)
      );

      const myPayload = `${PROTOCOL.prefix.hex}${PROTOCOL.headers.SELF_STASH.hex}${toHex("saved_handshake:")}${encryptedMessage.to_hex()}`;

      console.log("creating self stash...");

      // wait for mature UTXOs
      await walletStore.accountService.waitForMatureUTXO();

      // send the self stash transaction
      const txId = await walletStore.sendTransaction({
        payload: myPayload,
        toAddress: new Address(address),
        password: walletStore.unlockedWallet.password,
        customAmount: BigInt(0),
      });

      // save the self stash record
      await repositories?.savedHandshakeRepository?.saveSavedHandshake({
        id: `${walletStore.unlockedWallet.id}_${txId}`,
        createdAt: new Date(),
      });

      console.log("self stash created successfully:", txId);
      return txId;
    },
  };
});
