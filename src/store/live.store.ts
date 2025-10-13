import { create } from "zustand";
import { SenderAndAcceptanceResolutionService } from "../service/sender-and-acceptance-resolution-service";
import { RpcClient } from "kaspa-wasm";
import {
  BlockProcessorService,
  RawResolvedKasiaTransaction,
} from "../service/block-processor-service";
import { useMessagingStore } from "./messaging.store";

interface LiveState {
  saars: SenderAndAcceptanceResolutionService | undefined;
  blockProcessorService: BlockProcessorService | undefined;

  rpc: RpcClient | undefined;
  walletReceiveAddressString: string | undefined;

  start: (rpc: RpcClient, walletReceiveAddressString: string) => void;
  stop: () => Promise<void>;
}

export const useLiveStore = create<LiveState>((set, get) => {
  async function onRawKasiaTransactionReceived(
    tx: RawResolvedKasiaTransaction
  ) {
    try {
      await useMessagingStore.getState().ingestRawResolvedKasiaTransaction(tx);
    } catch (error) {
      console.error(
        "Live Store - Error while ingesting Live Kasia Transaction",
        error
      );
    }
  }

  const boundOnRawKasiaTransactionReceived =
    onRawKasiaTransactionReceived.bind(this);

  const onStart = () => {
    const { rpc, walletReceiveAddressString } = get();
    if (rpc && walletReceiveAddressString) {
      get().start(rpc, walletReceiveAddressString);
    }
  };
  const boundOnStart = onStart.bind(this);

  const onStop = () => {
    get().stop();
  };
  const boundOnStop = onStop.bind(this);

  return {
    saars: undefined,
    blockProcessorService: undefined,
    rpc: undefined,
    walletReceiveAddressString: undefined,
    start(rpc, walletReceiveAddressString) {
      const saars = new SenderAndAcceptanceResolutionService(rpc);
      const blockProcessorService = new BlockProcessorService(
        rpc,
        saars,
        walletReceiveAddressString
      );

      set({
        saars,
        blockProcessorService,
        rpc,
        walletReceiveAddressString,
      });

      rpc.addEventListener("disconnect", boundOnStop);
      rpc.removeEventListener("connect", boundOnStart);

      blockProcessorService.addListener(
        "newTransaction",
        boundOnRawKasiaTransactionReceived
      );
    },
    async stop() {
      get().rpc?.removeEventListener("disconnect", boundOnStop);
      get().rpc?.addEventListener("connect", boundOnStart);

      get().blockProcessorService?.removeListener(
        "newTransaction",
        boundOnRawKasiaTransactionReceived
      );

      await get().blockProcessorService?.stop();
      get().saars?.stop();
      set({
        saars: undefined,
        blockProcessorService: undefined,
      });
    },
  };
});
