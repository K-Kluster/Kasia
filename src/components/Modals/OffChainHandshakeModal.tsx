import React, { useState, useEffect } from "react";
import { Modal } from "../Common/modal";
import { CopyableValueWithQR } from "./CopyableValueWithQR";
import { Textarea } from "@headlessui/react";
import { Clipboard, QrCode, CheckCircle } from "lucide-react";
import { useFeatureFlagsStore } from "../../store/featureflag.store";
import { useMessagingStore } from "../../store/messaging.store";
import { useUiStore } from "../../store/ui.store";
import { toast } from "../../utils/toast-helper";
import { pasteFromClipboard } from "../../utils/clipboard";
import { Button } from "../Common/Button";
import { clsx } from "clsx";
import { Address } from "kaspa-wasm";
import { ALIAS_LENGTH } from "../../config/constants";
import { useSelfStash } from "../../hooks/useSelfStash";

interface OffChainHandshakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  kaspaAddress: string;
}

export const OffChainHandshakeModal: React.FC<OffChainHandshakeModalProps> = ({
  isOpen,
  onClose,
  kaspaAddress,
}) => {
  const [partnerAddress, setPartnerAddress] = useState<string>("");
  const [ourAliasForPartner, setOurAliasForPartner] = useState<string>("");
  const [theirAliasForUs, setTheirAliasForUs] = useState<string>("");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);
  const [activeQrSection, setActiveQrSection] = useState<string | null>(null);
  const [hideTitles, setHideTitles] = useState<boolean>(false);
  const [partnerAddressError, setPartnerAddressError] = useState<string | null>(
    null
  );
  const [aliasError, setAliasError] = useState<string | null>(null);

  const cameraEnabled = useFeatureFlagsStore((s) => s.flags.enabledcamera);
  const {
    createOffChainHandshake: createOffChainHandshake,
    generateUniqueAlias,
  } = useMessagingStore();
  const { openModal, setQrScannerCallback, modals } = useUiStore();

  // use self stash hook for handling handshake save logic
  const {
    isCreating: isCreatingSelfStash,
    isCompleted: selfStashCompleted,
    hasSufficientFunds: hasSufficientFundsForSelfStash,
    handleCreateSelfStash,
  } = useSelfStash({
    partnerAddress,
    ourAlias: ourAliasForPartner,
    theirAlias: theirAliasForUs,
    onCompleted: onClose,
  });

  // validate partner address (so we know the alias is right)
  const validatePartnerAddress = (
    address: string,
    ownAddress: string
  ): string | null => {
    if (!address) return null;

    // check if the partner address is the same as the user's own address
    if (address.toLowerCase() === ownAddress.toLowerCase()) {
      return "Participant address cannot be self";
    }

    try {
      // try to create an Address object - we use this for validation
      new Address(address);
      return null;
    } catch {
      // check if it starts with proper Kaspa prefixes
      if (
        !address.startsWith("kaspa:") &&
        !address.startsWith("kaspatest:") &&
        !address.startsWith("kaspadev:")
      ) {
        return "Invalid Kaspa address format. Must start with 'kaspa:', 'kaspatest:', or 'kaspadev:'";
      }

      return "Invalid Kaspa address format";
    }
  };

  // validate alias length
  const validateAlias = (alias: string): string | null => {
    if (!alias) return null;

    if (alias.length !== ALIAS_LENGTH * 2) {
      return `Alias must be exactly ${ALIAS_LENGTH * 2} characters long.`;
    }

    // Check if it's valid hex
    if (!/^[0-9a-fA-F]+$/.test(alias)) {
      return "Alias must contain only hexadecimal characters (0-9, a-f, A-F)";
    }

    return null;
  };

  // update partner address and generate our alias for them
  const updatePartnerAddress = (address: string) => {
    const v = address.trim().toLowerCase();
    setPartnerAddress(v);

    // validate the address
    const validationError = validatePartnerAddress(v, kaspaAddress);
    setPartnerAddressError(validationError);

    if (v && !validationError) {
      const generatedAlias = generateUniqueAlias();
      setOurAliasForPartner(generatedAlias);
    } else {
      // clear alias if address is cleared or invalid
      setOurAliasForPartner("");
    }
  };

  // handle paste from clipboard
  const handlePaste = async () => {
    const text = await pasteFromClipboard();
    updatePartnerAddress(text);
  };

  // handle paste for alias field
  const handleAliasPaste = async () => {
    const text = await pasteFromClipboard("Alias pasted from clipboard");
    updateTheirAlias(text);
  };

  // handle QR scan - uses the same pattern as NewChatForm
  const handleQrScan = () => {
    // set the callback to handle scanned data (same as NewChatForm)
    setQrScannerCallback((data: string) => {
      updatePartnerAddress(data);
    });
    // open the QR scanner modal (same as NewChatForm)
    openModal("qr-scanner");
  };

  // update partner's alias and validate it
  const updateTheirAlias = (alias: string) => {
    const trimmedAlias = alias.trim().toLowerCase();
    setTheirAliasForUs(trimmedAlias);

    // validate the alias
    const validationError = validateAlias(trimmedAlias);
    setAliasError(validationError);
  };

  // handle QR scan for partner's alias
  const handleAliasQrScan = () => {
    setQrScannerCallback((data: string) => {
      updateTheirAlias(data);
      toast.info("Partner's alias scanned from QR code");
    });
    openModal("qr-scanner");
  };

  // handle QR toggle from CopyableValueWithQR components
  const handleAddressQrToggle = (open: boolean) => {
    setIsQrOpen(open);
    setActiveQrSection(open ? "address" : null);
    setHideTitles(open);
  };

  const handleAliasQrToggle = (open: boolean) => {
    setIsQrOpen(open);
    setActiveQrSection(open ? "alias" : null);
    setHideTitles(open);
  };

  // reset QR state when scanner modal closes
  useEffect(() => {
    const isQrScannerOpen = modals["qr-scanner"];
    if (!isQrScannerOpen) {
      setIsQrOpen(false);
      setActiveQrSection(null);
      setHideTitles(false);
    }
  }, [modals]);

  // complete the off-chain handshake
  const handleCompleteHandshake = async () => {
    if (!partnerAddress || !ourAliasForPartner || !theirAliasForUs) {
      toast.error("Please fill in all required information");
      return;
    }

    if (partnerAddressError) {
      toast.error("Please fix the partner address error before continuing");
      return;
    }

    if (aliasError) {
      toast.error("Please fix the alias validation error before continuing");
      return;
    }
    setIsCreating(true);
    try {
      await createOffChainHandshake(
        partnerAddress,
        ourAliasForPartner,
        theirAliasForUs
      );
      setIsCompleted(true);
      toast.success("Off-chain handshake completed successfully!");
    } catch (error) {
      console.error("Failed to create off-chain handshake:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create off-chain handshake"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const titleRow = (opts: {
    hidden: boolean;
    section?: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <div
      className={clsx(
        "transition-all duration-300 ease-in-out",
        opts.hidden
          ? "mb-0 max-h-0 overflow-hidden opacity-0"
          : "mb-2 max-h-10 opacity-100",
        opts.className
      )}
    >
      {opts.children}
    </div>
  );

  const blockVisible = (hidden: boolean) =>
    clsx(
      "transition-all duration-300 ease-in-out",
      hidden ? "max-h-0 overflow-hidden opacity-0" : "max-h-96 opacity-100"
    );

  const canComplete = !!(
    partnerAddress &&
    ourAliasForPartner &&
    theirAliasForUs &&
    !partnerAddressError &&
    !aliasError
  );

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div className="w-full">
        <h2 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">
          Off-Chain Handshake
        </h2>
        {!isQrOpen && (
          <p className="mb-2 text-xs whitespace-pre-line text-[var(--text-secondary)] sm:text-sm">
            Connect with someone without on-chain interaction by exchanging
            addresses and aliases.{"\n"}No tx is sent between parties.
          </p>
        )}

        {/* Input sections - hide when completed */}
        <div
          className={clsx(
            "space-y-2 transition-all duration-500 ease-in-out",
            isCompleted
              ? "max-h-0 overflow-hidden opacity-0"
              : "max-h-screen opacity-100"
          )}
        >
          {/* Your Kaspa Address Section */}
          <div>
            {titleRow({
              hidden: hideTitles && activeQrSection !== "address",
              children: (
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Your Address
                </h3>
              ),
            })}
            <div
              className={blockVisible(
                isQrOpen && activeQrSection !== "address"
              )}
            >
              <CopyableValueWithQR
                value={kaspaAddress}
                label=""
                qrTitle="QR Code for Address"
                onQrToggle={handleAddressQrToggle}
              />
            </div>
          </div>

          {/* Partner Address Input Section */}
          <div>
            {titleRow({
              hidden: hideTitles,
              children: (
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Partner's Address
                </h3>
              ),
            })}
            <div className={blockVisible(isQrOpen)}>
              <div className="relative">
                <Textarea
                  className="bg-primary-bg border-primary-border w-full resize-none rounded-lg border p-2 pr-20 text-base text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none"
                  rows={2}
                  value={partnerAddress}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    updatePartnerAddress(e.target.value)
                  }
                  placeholder="Enter partner's Kaspa address or paste/scan QR code"
                  autoComplete="off"
                  aria-label="Partner Kaspa address"
                />
                <div className="absolute right-1 bottom-1 flex gap-1 pb-1">
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="bg-kas-secondary/10 border-kas-secondary hover:bg-kas-secondary/20 active:bg-kas-secondary/30 cursor-pointer rounded-lg border px-1.5 py-1 transition-colors"
                    title="Paste from clipboard"
                    aria-label="Paste from clipboard"
                  >
                    <Clipboard size={16} />
                  </button>
                  {cameraEnabled && (
                    <button
                      type="button"
                      className="bg-kas-secondary/10 border-kas-secondary hover:bg-kas-secondary/20 active:bg-kas-secondary/30 cursor-pointer rounded-lg border p-1"
                      onClick={handleQrScan}
                      title="Scan QR code"
                      aria-label="Scan QR code"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {partnerAddressError && (
                <div className="mt-2 rounded-lg border border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.1)] p-2.5 text-sm text-[#ff4444]">
                  {partnerAddressError}
                </div>
              )}
            </div>
          </div>

          {/* Alias Sections - Vertical Layout */}
          {(ourAliasForPartner || partnerAddress) && (
            <div className="space-y-1">
              {/* Our Alias for Partner Section */}
              {ourAliasForPartner && (
                <div>
                  {titleRow({
                    hidden: hideTitles && activeQrSection !== "alias",
                    children: (
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Your Alias for Partner
                      </h3>
                    ),
                  })}
                  <div
                    className={blockVisible(
                      isQrOpen && activeQrSection !== "alias"
                    )}
                  >
                    <div className="flex justify-center">
                      <CopyableValueWithQR
                        value={ourAliasForPartner}
                        label=""
                        qrTitle="QR Code for Alias"
                        onQrToggle={handleAliasQrToggle}
                      />
                    </div>
                    <div
                      className={clsx(
                        "transition-all duration-300 ease-in-out",
                        hideTitles
                          ? "max-h-0 overflow-hidden opacity-0"
                          : "max-h-10 opacity-100"
                      )}
                    >
                      <p className="mt-1 mb-2 text-xs font-normal text-[var(--text-secondary)]">
                        Show this alias to your partner
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Partner's Alias for Us Section */}
              {partnerAddress && (
                <div>
                  {titleRow({
                    hidden: hideTitles,
                    className: "mb-2",
                    children: (
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Partner's Alias for You
                      </h3>
                    ),
                  })}
                  <div className={blockVisible(isQrOpen)}>
                    <div className="relative">
                      <input
                        type="text"
                        className="border-primary-border bg-primary-bg flex min-h-14 w-full cursor-text items-center rounded-lg border px-3 py-2 pr-20 font-mono text-base leading-[1.4] break-all text-[var(--text-primary)] placeholder-gray-400 transition-colors focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none"
                        value={theirAliasForUs}
                        onChange={(e) => updateTheirAlias(e.target.value)}
                        placeholder="Enter the alias your partner generated for you"
                        autoComplete="off"
                        aria-label="Partner alias for you"
                      />
                      <div className="absolute right-1 bottom-1 flex gap-1 pb-1">
                        <button
                          type="button"
                          onClick={handleAliasPaste}
                          className="bg-kas-secondary/10 border-kas-secondary hover:bg-kas-secondary/20 active:bg-kas-secondary/30 cursor-pointer rounded-lg border px-1.5 py-1 transition-colors"
                          title="Paste from clipboard"
                          aria-label="Paste alias from clipboard"
                        >
                          <Clipboard size={16} />
                        </button>
                        {cameraEnabled && (
                          <button
                            type="button"
                            onClick={handleAliasQrScan}
                            className="bg-kas-secondary/10 border-kas-secondary hover:bg-kas-secondary/20 active:bg-kas-secondary/30 cursor-pointer rounded-lg border p-1 transition-colors"
                            title="Scan QR code"
                            aria-label="Scan alias QR"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Ask your partner for the alias they generated when they
                      entered your address
                    </p>

                    {aliasError && (
                      <div className="mt-2 rounded-lg border border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.1)] p-2.5 text-sm text-[#ff4444]">
                        {aliasError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action sections - always visible */}
        <div className="mt-2 space-y-2">
          {/* complete handshake button */}
          {!isCompleted && canComplete && (
            <div className={blockVisible(isQrOpen)}>
              <Button
                onClick={handleCompleteHandshake}
                disabled={isCreating || !canComplete}
                aria-disabled={isCreating || !canComplete}
              >
                {isCreating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
                    Creating Handshake...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Complete Off-Chain Handshake
                  </div>
                )}
              </Button>

              <p className="mt-2 overflow-visible text-center text-xs text-[var(--text-secondary)]">
                This will create a new conversation with{" "}
                <span className="inline-block max-w-full align-top break-words break-all whitespace-pre-wrap">
                  {partnerAddress}
                </span>
              </p>
            </div>
          )}

          {/* self stash section - shows after handshake completion */}
          {isCompleted && (
            <div className="space-y-2">
              <div>
                {titleRow({
                  hidden: hideTitles,
                  children: (
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      Save Handshake for Multi-Device Use
                    </h3>
                  ),
                })}
                <div className={blockVisible(isQrOpen)}>
                  <div className="rounded-lg border border-[var(--button-primary)]/20 bg-[var(--button-primary)]/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 flex-shrink-0 text-[var(--kas-secondary)]" />
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            Off-chain handshake completed successfully!
                          </p>
                        </div>
                        <p className="mb-3 text-xs text-[var(--text-secondary)]">
                          Send transaction to backup your private handshake
                          on-chain. This saves both the initiation and response,
                          allowing kasia to auto-sync the full conversation if
                          you switch device. Minimal tx fees apply.
                        </p>

                        {!selfStashCompleted ? (
                          <Button
                            onClick={handleCreateSelfStash}
                            disabled={
                              isCreatingSelfStash ||
                              !hasSufficientFundsForSelfStash
                            }
                            className="w-full"
                          >
                            {isCreatingSelfStash ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
                                Creating save handshake...
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="size-5" />
                                Save Handshake
                              </div>
                            )}
                          </Button>
                        ) : (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--kas-primary)]/20 bg-[var(--kas-primary)]/10 p-2">
                            <CheckCircle className="h-4 w-4 text-[var(--kas-secondary)]" />
                            <span className="text-sm font-semibold text-[var(--kas-secondary)]">
                              Off-chain handshake saved successfully!
                            </span>
                          </div>
                        )}

                        {!hasSufficientFundsForSelfStash &&
                          !selfStashCompleted && (
                            <p className="mt-2 text-xs text-[var(--accent-red)]">
                              Insufficient funds. You need at least 0.19 KAS to
                              create a self stash.
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
