import { useNetworkStore } from "../store/network.store";
import { useWalletStore } from "../store/wallet.store";
import { NetworkType } from "../types/all";
import { client as indexerClient } from "../service/indexer/generated/client.gen";
import { useToastStore } from "../store/toast.store";
import { useMessagingStore } from "../store/messaging.store";
import { useDBStore } from "../store/db.store";
import { UnlockedWallet } from "../types/wallet.type";
import { useLiveStore } from "../store/live.store";
import { useBroadcastStore } from "../store/broadcast.store";
import { useFeatureFlagsStore, FeatureFlags } from "../store/featureflag.store";
import { useBlocklistStore } from "../store/blocklist.store";
import { getEffectiveIndexerUrl } from "../utils/indexer-settings";

export type ConnectOpts = {
  networkType?: NetworkType;
  nodeUrl?: string | null;
};

export type StartSessionOpts = {
  walletId: string;
  walletPassword: string;
};

export class StartSessionInvalidPasswordException extends Error {
  constructor() {
    super();

    this.name = StartSessionInvalidPasswordException.name;
    this.message = "Invalid Password";
  }
}

export const useOrchestrator = () => {
  const networkStore = useNetworkStore();
  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();
  const dbStore = useDBStore();
  const liveStore = useLiveStore();
  const broadcastStore = useBroadcastStore();

  const toastStore = useToastStore();

  const connect = async (opts?: ConnectOpts) => {
    const baseNetwork = networkStore.network;

    // update indexer base url
    const network =
      (opts?.networkType ?? baseNetwork) === "mainnet" ? "mainnet" : "testnet";
    indexerClient.setConfig({
      baseUrl: getEffectiveIndexerUrl(network),
    });

    if (opts?.networkType) {
      networkStore.setNetwork(opts.networkType);
    }

    if (opts?.nodeUrl !== undefined) {
      networkStore.setNodeUrl(opts.nodeUrl);
    }

    try {
      await networkStore.connect();

      const freshNetworkStore = useNetworkStore.getState();

      walletStore.setRpc(freshNetworkStore.rpc);
      walletStore.setSelectedNetwork(freshNetworkStore.network);
    } catch (error) {
      if (error instanceof Error) {
        toastStore.add(
          "error",
          `Error while connecting to the network: ${error.message}`,
          5000
        );
        throw error;
      }
      console.error(`Unknown error while connecting to the network`, error);
      throw error;
    }
  };

  // pre-assumption: db has been opened and network is connected
  // 1.  unlock wallet
  // 2.a start account service - later this step will be removed in favor of a wallet service contained in wallet store
  // 2.b init repositories (with tenancy and wallet password)
  // 3.  migrate storage
  // 4.  messaging store initial load, hydrate local store + partially lazy fetch historical ones
  // 5.  start live store which process incoming block and resolve transaction acceptance data and sender
  const startSession = async (opts: StartSessionOpts) => {
    console.log("STARTING SESSION");
    let unlockedWallet: UnlockedWallet | undefined;
    try {
      unlockedWallet = await walletStore.unlock(
        opts.walletId,
        opts.walletPassword
      );
    } catch (error) {
      console.error(error);
      throw new StartSessionInvalidPasswordException();
    }

    // check the previously opened wallet (in the same session)
    // if different, then clear memory so we dont visually leak anything.
    const lastOpenedWallet = sessionStorage.getItem("last_opened_tenant_id");
    if (lastOpenedWallet && lastOpenedWallet !== opts.walletId) {
      await cleanUpPreviousSession();
    }

    // store the opened tenant as latest
    sessionStorage.setItem("last_opened_tenant_id", opts.walletId);

    dbStore.initRepositories(unlockedWallet);

    const receivedAddressString = unlockedWallet.receivePublicKey
      .toAddress(networkStore.network)
      .toString();

    // Clear old conversations and related state before loading new wallet data to prevent flash
    useMessagingStore.setState({
      oneOnOneConversations: [],
      openedRecipient: null,
      isLoaded: false,
      conversationManager: null,
    });

    // load blocked addresses BEFORE messaging store to prevent rehydrating blocked contacts
    try {
      await useBlocklistStore.getState().loadBlockedAddresses();
      console.log("Blocked addresses loaded");
    } catch (error) {
      console.error(
        "Failed to load blocked addresses during initialization:",
        error
      );
    }

    await messagingStore.load(receivedAddressString);

    // load broadcast channels async so we can start processing them straight away
    const isBroadcastEnabled =
      useFeatureFlagsStore.getState().flags[FeatureFlags.BROADCAST];
    if (isBroadcastEnabled) {
      useBroadcastStore
        .getState()
        .loadChannels()
        .then(async () => {
          console.log("Broadcast channels loaded");

          // Add default broadcast channel if not already added
          const defaultsLoaded = localStorage.getItem(
            "kasia-load-defaults-true"
          );
          if (!defaultsLoaded) {
            try {
              await useBroadcastStore
                .getState()
                .addChannel("kasia-general", "default");
              localStorage.setItem("kasia-load-defaults-true", "true");
              console.log("Added default broadcast channel: kasia-general");
            } catch (error) {
              console.error("Failed to add default broadcast channel:", error);
            }
          }
        })
        .catch((error) =>
          console.error(
            "Failed to load broadcast channels during initialization:",
            error
          )
        );
    }

    if (networkStore.rpc) {
      liveStore.start(networkStore.rpc, receivedAddressString);
    }
  };

  /**
   * Utility for mobile application that can pause
   */
  const onPause = async () => {
    console.log("onPause - checking if disconnect is needed");
    if (networkStore.rpc.isConnected) {
      console.log("onPause - disonnect is needed");
      await networkStore.disconnect();
      console.log("onPause - disonnected");
    }
  };

  /**
   * Utility for mobile application that can resume
   */
  const onResume = async () => {
    console.log("onResume - checking if reconnect is needed");
    if (!networkStore.rpc.isConnected) {
      console.log("onResume - reconnect is needed");
      await networkStore.connect();
      console.log("onResume - connect successful");
    }
  };

  const cleanUpPreviousSession = async () => {
    console.log("Cleaning up previous session data");

    // clear messaging store state to prevent
    useMessagingStore.setState({
      oneOnOneConversations: [],
      openedRecipient: null,
      isLoaded: false,
      conversationManager: null,
    });

    // clear broadcast store to prevent channel/message bleed
    broadcastStore.reset();

    // clear blocklist store to prevent address list bleed
    useBlocklistStore.getState().reset();
  };

  return { connect, startSession, onPause, onResume };
};
