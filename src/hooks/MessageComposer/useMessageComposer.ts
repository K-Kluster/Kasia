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

  const send = async (myAlias: string) => {
    if (!recipient) {
      toast.error("Error, please select a contact.");
      return;
    }
    if (!myAlias) {
      toast.error("Valid Alias needed for sending.");
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

      let txId = "";
      txId = await walletStore.sendMessageWithContext({
        message: messageToSend,
        toAddress: new Address(recipient),
        password: walletStore.unlockedWallet.password,
        myAlias,
        priorityFee: priority,
      });

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
        fee: feeState.value || 0,
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
