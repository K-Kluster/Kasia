import { useComposerStore } from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { useMessagingStore } from "../../store/messaging.store";
import { Address } from "kaspa-wasm";
import { toast } from "../../utils/toast-helper";
import { unknownErrorToErrorLike } from "../../utils/errors";
import { useFeeEstimate } from "./useFeeEstimate";
import { Message } from "../../types/all";
import { prepareFileForUpload } from "../../service/upload-file-service";
import { MAX_PAYLOAD_SIZE } from "../../config/constants";

export const useMessageComposer = (recipient?: string) => {
  const {
    attachment,
    priority,
    sendState,
    setSendState,
    feeState,
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
      const typedAttachment = {
        type: file.type.startsWith("image/")
          ? ("image" as const)
          : ("file" as const),
        name: file.name,
        mime: file.type,
        data: fileMessage,
        size: file.size,
      };

      setAttachment(typedAttachment);
      toast.success(`Attached ${source.toLowerCase()} successfully!`);
    }
  };

  const send = async () => {
    // check recipient first
    if (!recipient) {
      toast.error("Error, please select a contact.");
      return;
    }

    // check wallet unlock status
    if (!walletStore.unlockedWallet) {
      toast.error("Error, reload app.");
      return;
    }

    // check wallet address
    if (!walletStore.address) {
      toast.error(
        "No wallet address found. Please check your wallet connection."
      );
      return;
    }

    // check if there's content to send
    if (!draft && !attachment) {
      toast.error("Please enter a message or attach a file.");
      return;
    }

    // check fee estimation status
    if (feeState.status === "error") {
      toast.error("Fee estimation failed. Please try again or reload the app.");
      return;
    }

    // check if already sending
    if (sendState.status === "loading") {
      return;
    }

    setSendState({ status: "loading" });
    try {
      let messageToSend = draft;
      let fileDataForStorage = null;

      if (attachment) {
        try {
          const parsedData = JSON.parse(attachment.data);
          messageToSend = attachment.data; // Send the full JSON, not just content
          fileDataForStorage = {
            type: parsedData.type,
            name: parsedData.name,
            size: parsedData.size,
            mimeType: parsedData.mimeType,
            content: parsedData.content,
          };
        } catch (error) {
          console.error("Error parsing attachment data:", error);
          messageToSend = draft;
        }
      }

      const txId = await walletStore.sendMessage({
        message: messageToSend,
        toAddress: new Address(recipient),
        password: walletStore.unlockedWallet.password,
        priorityFee: priority,
      });

      const newMessageData: Message = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipient,
        timestamp: Date.now(),
        content: fileDataForStorage
          ? JSON.stringify(fileDataForStorage)
          : draft,
        amount: 20000000, // 0.2 KAS in sompi
        fee: feeState.value || undefined,
        payload: "",
        fileData: fileDataForStorage || undefined,
      };

      // store message under both sender and recipient addresses for proper conversation grouping
      messageStore.storeMessage(newMessageData, walletStore.address.toString());
      messageStore.storeMessage(newMessageData, recipient);
      messageStore.addMessages([newMessageData]);

      // keep the conversation open with the same recipient
      messageStore.setOpenedRecipient(recipient);

      // clear only this contact's draft and reset other states
      if (recipient) {
        clearDraft(recipient);
      }
      setAttachment(null);
      setSendState({ status: "idle" });
    } catch (error) {
      console.error("Error sending message:", error);
      setSendState({ status: "error", error: error as Error });
      toast.error(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  };

  useFeeEstimate(recipient);

  return { send, attach };
};
