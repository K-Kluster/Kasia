import React, { useState } from "react";
import { Button } from "../Common/Button";
import { useBroadcastStore } from "../../store/broadcast.store";
import { toast } from "../../utils/toast-helper";
import clsx from "clsx";
import { MAX_BROADCAST_CHANNEL_NAME } from "../../config/constants";
import { validateChannelName } from "../../utils/channel-validator";

interface NewBroadcast {
  onClose: () => void;
}

export const NewBroadcast: React.FC<NewBroadcast> = ({ onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addChannel = useBroadcastStore((state) => state.addChannel);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // clear error when user starts typing
    if (error) setError(null);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDescription(value);

    // clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAdd();
  };

  const handleAdd = async () => {
    const validation = validateChannelName(inputValue);
    if (!validation.isValid) {
      setError(validation.error || "Invalid channel name");
      return;
    }

    setIsLoading(true);
    toast.removeAll();
    try {
      await addChannel(inputValue, description.trim() || "Broadcast channel");
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to add channel. Please try again.";
      setError(errorMessage); // use setError for store errors too
      console.error("Error adding broadcast channel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isInputValid = validateChannelName(inputValue).isValid && !error;
  return (
    <>
      <h3 className="mb-5 text-base font-semibold">Broadcast Channel</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label
            className="mb-[5px] block text-[14px] font-bold"
            htmlFor="channelName"
          >
            Channel Name
          </label>
          <input
            type="text"
            id="channelName"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Name your channel to tune in to (e.g. general)"
            maxLength={MAX_BROADCAST_CHANNEL_NAME}
            className="border-primary-border bg-primary-bg w-full rounded-lg border px-3 py-2 text-base text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none"
            disabled={isLoading}
            required
          />
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {inputValue.length}/{MAX_BROADCAST_CHANNEL_NAME} characters
          </p>
        </div>

        <div className="mb-3">
          <label
            className="mb-[5px] block text-[14px] font-bold"
            htmlFor="channelDescription"
          >
            Description (Optional)
          </label>
          <input
            type="text"
            id="channelDescription"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Enter description"
            maxLength={100}
            className="border-primary-border bg-primary-bg w-full rounded-lg border px-3 py-2 text-base text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {description.length}/100 characters
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.1)] p-2.5 text-sm text-[#ff4444]">
            {error}
          </div>
        )}

        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button
            type="submit"
            disabled={!isInputValid || isLoading}
            variant="primary"
          >
            {isLoading ? "Adding..." : "Add Channel"}
          </Button>
          <Button onClick={onClose} disabled={isLoading} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};
