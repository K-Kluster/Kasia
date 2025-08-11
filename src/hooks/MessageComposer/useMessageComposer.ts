import { useComposerStore } from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { useMessagingStore } from "../../store/messaging.store";
import { Address } from "kaspa-wasm";
import { toast } from "../../utils/toast-helper";
import { unknownErrorToErrorLike } from "../../utils/errors";
import { prepareFileForUpload } from "../../service/upload-file-service";
import { MAX_PAYLOAD_SIZE } from "../../config/constants";
import { KasiaTransaction, FeeState } from "../../types/all";
import { FileData } from "../../store/repository/message.repository";

export const useMessageComposer = (feeState: FeeState, recipient?: string) => {
  const {
    attachment,
    priority,
    sendState,
    setSendState,
    setAttachment,
    clearDraft,
  } = useComposerStore();
  const draft = useComposerStore((s) =>
    recipient ? s.drafts[recipient] || "" : ""
  );
  const walletStore = useWalletStore();
  const messageStore = useMessagingStore();

  const attach = async (file: File, source: string = "File") => {
    const { fileMessage, error } = await prepareFileForUpload(
      file,
      MAX_PAYLOAD_SIZE,
      {},
      (status) => {
        toast.info(status);
      }
    );
    if (error) {
      toast.error(error);
      return;
    }
    if (fileMessage) {
      setAttachment({
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        mimeType: file.type,
        content: fileMessage,
        size: file.size,
      });
      toast.success(`Attached ${source.toLowerCase()} successfully!`);
    }
  };

  const send = async (myAlias?: string) => {
    if (!recipient) {
      toast.error("Error, please select a contact.");
      return;
    }
    if (!walletStore.unlockedWallet) {
      toast.error("Error, reload app.");
      return;
    }
    if (!walletStore.address) {
      toast.error(
        "No wallet address found. Please check your wallet connection."
      );
      return;
    }
    if (!draft && !attachment) {
      toast.error("Please enter a message or attach a file.");
      return;
    }

    // require valid fee state before sending
    if (
      !feeState ||
      feeState.status !== "idle" ||
      typeof feeState.value !== "number"
    ) {
      toast.error("Please wait for fee calculation to complete.");
      return;
    }

    if (sendState.status === "loading") {
      return;
    }

    setSendState({ status: "loading" });
    try {
      let messageToSend = draft;
      let fileDataForStorage: FileData | null = null;

      if (attachment) {
        messageToSend = attachment.content; // always send attachment payload
        try {
          const parsed = JSON.parse(attachment.content);
          fileDataForStorage = {
            type: parsed.type,
            name: parsed.name,
            size: parsed.size,
            mimeType: parsed.mimeType,
            content: parsed.content,
          };
        } catch {
          fileDataForStorage = null;
        }
      }

      // check if we have an active conversation with this recipient
      // const activeConversations =
      //   messageStore.getActiveConversationsWithContacts();
      // const existingConversation = activeConversations.find(
      //   (conv) => conv.contact.kaspaAddress === recipient
      // );

      // let txId: string;

      // // if we have an active conversation, use the context-aware sending
      // if (
      //   existingConversation &&
      //   existingConversation.conversation.theirAlias
      // ) {
      //   console.log("Sending message with conversation context:", {
      //     recipient,
      //     theirAlias: existingConversation.conversation.theirAlias,
      //     priorityFee: priority,
      //   });

      //   if (!walletStore.accountService) {
      //     throw new Error("Account service not initialized");
      //   }

      //   // use the account service directly for context-aware sending
      //   txId = await walletStore.accountService.sendMessageWithContext({
      //     toAddress: new Address(recipient),
      //     message: messageToSend,
      //     password: walletStore.unlockedWallet.password,
      //     theirAlias: existingConversation.conversation.theirAlias,
      //     priorityFee: priority,
      //   });
      // } else {
      //   // if no active conversation or no alias, use regular sending
      //   console.log(
      //     "No active conversation found, sending regular message with priority fee:",
      //     priority
      //   );
      let txId = "";
      if (myAlias) {
        txId = await walletStore.sendMessageWithContext({
          message: messageToSend,
          toAddress: new Address(recipient),
          password: walletStore.unlockedWallet.password,
          myAlias,
          priorityFee: priority,
        });
      } else {
        txId = await walletStore.sendMessage({
          message: messageToSend,
          toAddress: new Address(recipient),
          password: walletStore.unlockedWallet.password,
          priorityFee: priority,
        });
      }

      const event: KasiaTransaction = {
        transactionId: txId,
        senderAddress: walletStore.unlockedWallet.receivePublicKey
          .toAddress(walletStore.selectedNetwork)
          .toString(),
        recipientAddress: recipient,
        createdAt: new Date(),
        content: fileDataForStorage
          ? JSON.stringify(fileDataForStorage)
          : draft,
        amount: 20000000,
        fee: feeState.value,
        payload: "",
      };

      await messageStore.storeKasiaTransactions([event]);
      messageStore.setOpenedRecipient(recipient);

      if (recipient) clearDraft(recipient);
      setAttachment(null);
      setSendState({ status: "idle" });
    } catch (error) {
      setSendState({ status: "error", error: error as Error });
      toast.error(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  };


  return {
    /**
     * Send a message to the recipient
     *
     * param myAlias - My alias (optional)
     */
    send,
    /**
     * Attach a file to the message
     */
    attach,
  };
};
