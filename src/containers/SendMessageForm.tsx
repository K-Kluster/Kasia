import { FC, useCallback, useEffect, useRef } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { Message } from "../type/all";
import { amountFromMessage } from "../utils/amount-from-message";
import { unknownErrorToErrorLike } from "../utils/errors";
import { Input } from "@headlessui/react";
import { useWalletStore } from "../store/wallet.store";
import { Address } from "kaspa-wasm";

type SendMessageFormProps = unknown;

export const SendMessageForm: FC<SendMessageFormProps> = () => {
  const openedRecipient = useMessagingStore((s) => s.openedRecipient);
  const walletStore = useWalletStore();
  const isCreatingNewChat = useMessagingStore((s) => s.isCreatingNewChat);

  const messageStore = useMessagingStore();

  const recipientInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    console.log("Opened recipient:", openedRecipient);

    if (openedRecipient) {
      recipientInputRef.current!.value = openedRecipient;
      messageInputRef.current!.focus();
    }
  }, [openedRecipient]);

  useEffect(() => {
    if (isCreatingNewChat) {
      recipientInputRef.current!.value = "";
      messageInputRef.current!.value = "";
      recipientInputRef.current!.focus();
    }
  }, [isCreatingNewChat]);

  const onSendClicked = useCallback(async () => {
    if (!walletStore.address) {
      alert("Shouldn't occurs, no selected address");
      return;
    }

    if (!walletStore.unlockedWallet) {
      alert("Shouldn't occurs, no unlocked wallet");
      return;
    }

    const messageInput = document.getElementById("messageInput");
    const recipientInput = document.getElementById("recipientAddress");

    if (
      !recipientInput ||
      !(recipientInput instanceof HTMLInputElement) ||
      !messageInput ||
      !(messageInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const message = messageInput.value.trim();
    const recipient = recipientInput.value.trim();

    if (!message) {
      alert("Please enter a message");
      return;
    }
    if (!recipient) {
      alert("Please enter a recipient address");
      return;
    }

    try {
      console.log("Sending transaction");

      const txId = await walletStore.sendMessage(
        message,
        new Address(recipient),
        walletStore.unlockedWallet.password
      );

      // const txResponse = await window.kasware.sendKaspa(
      //   recipient,
      //   amount.toString(),
      //   {
      //     payload: message,
      //     encoding: "utf8",
      //     mass: "1000000",
      //   }
      // );

      console.log("Message sent! Transaction response:", txId);

      const newMessageData: Message = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipient,
        timestamp: Date.now(),
        content: message,
        // @TODO: fixme
        amount: 0.69,
        payload: "",
      };

      messageStore.storeMessage(newMessageData, walletStore.address.toString());

      messageInput.value = "";
      recipientInput.value = "";

      messageStore.addMessages([newMessageData]);

      messageStore.setOpenedRecipient(recipient);
      messageStore.setIsCreatingNewChat(false);
    } catch (error) {
      console.error("Error sending message:", error);

      alert(`Failed to send message: ${unknownErrorToErrorLike(error)}`);
    }
  }, [messageStore, walletStore]);

  const onMessageInputKeyPressed = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        onSendClicked();
      }
    },
    [onSendClicked]
  );

  useEffect(() => {
    const messageInput = messageInputRef.current;
    if (messageInput) {
      messageInput.addEventListener("keypress", onMessageInputKeyPressed);
    }

    return () => {
      if (messageInput) {
        messageInput.removeEventListener("keypress", onMessageInputKeyPressed);
      }
    };
  }, [messageInputRef, onMessageInputKeyPressed]);

  return (
    <div className="message-input-container">
      <Input
        ref={recipientInputRef}
        type="text"
        id="recipientAddress"
        placeholder="Recipient address"
        className="recipient-input"
      />
      <div className="message-input-wrapper">
        <Input
          ref={messageInputRef}
          type="text"
          id="messageInput"
          placeholder="Type your message..."
          className="message-input"
        />
        <button onClick={onSendClicked} id="sendButton" className="send-button">
          Send
        </button>
      </div>
    </div>
  );
};
