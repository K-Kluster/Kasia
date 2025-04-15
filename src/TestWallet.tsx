import { useCallback, useEffect, useMemo, useState } from "react";
import { KaspaClient } from "./utils/all-in-one";
import { useWalletStore } from "./store/wallet.store";
import { Address, Mnemonic } from "kaspa-wasm";
import { decrypt_message, encrypt_message, PrivateKey } from "cipher";

export const TestWallet = () => {
  const [isConnected, setIsConnected] = useState(false);

  const walletStore = useWalletStore();
  const walletStop = useWalletStore((state) => state.stop);

  const kaspaClient = useMemo(() => {
    return new KaspaClient("testnet-10");
  }, []);

  useEffect(() => {
    if (!kaspaClient) return;

    (async () => {
      await kaspaClient.connect();
      setIsConnected(true);
    })();

    return () => {
      walletStop();

      kaspaClient.disconnect();
      setIsConnected(false);
    };
  }, [kaspaClient, walletStop]);

  const onCreateWalletClicked = useCallback(async () => {
    const mnemonic = Mnemonic.random(24);
    await walletStore.create(mnemonic, "password");
  }, [walletStore]);

  const onUnlockWalletClicked = useCallback(async () => {
    await walletStore.unlock("password");
  }, [walletStore]);

  const onStartAccountServiceClicked = useCallback(async () => {
    await walletStore.start(kaspaClient, walletStore.unlockedWallet!);
  }, [kaspaClient, walletStore]);

  const onTest = useCallback(async () => {
    const address = walletStore.address;

    if (!address) return;

    console.log(address);

    const encryptedMessage = encrypt_message(
      address.toString(),
      "Bonjour j'espère que vous allez bien les amis!"
    );


    console.log(encryptedMessage.to_hex());
  }, [walletStore]);

  const onTestSend = useCallback(async () => {
    const address = new Address(
      "kaspatest:qqd2q3ezkrfxkedy6skvr37lrp4mg6fxqp0rndcz9g8md7hl6zc7x89rmdyy5"
    );

    const txId = await walletStore
      .sendMessage("Bonjour Monde!", address, "password")
      .catch(console.error);

    console.log({ txId });
  }, [walletStore]);

  const canStartAccountService = useMemo(() => {
    return (
      walletStore.doesExists &&
      walletStore.unlockedWallet !== null &&
      !walletStore.isAccountServiceRunning
    );
  }, [walletStore]);

  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <p>isConnected: {isConnected ? "true" : "false"}</p>

      {isConnected && (
        <>
          {/* Doesn't exists yet */}
          {!walletStore.doesExists && (
            <button onClick={onCreateWalletClicked}>Create Wallet</button>
          )}

          {/* Exists but locked (encrypted) */}
          {walletStore.doesExists && !walletStore.unlockedWallet && (
            <button onClick={onUnlockWalletClicked}>Unlock Wallet</button>
          )}

          {/* Exists and unlocked */}
          {canStartAccountService && (
            <button onClick={onStartAccountServiceClicked}>
              Start Account Service
            </button>
          )}

          {/* Account service is running */}
          {walletStore.isAccountServiceRunning && (
            <>
              <p>Account service is running</p>
              <p>Balance: {walletStore.balance}</p>
              <p>Receive Address: {walletStore.address?.toString()}</p>

              <button onClick={onTest}>Test Encrypt</button>

              <button onClick={onTestSend}>Send Message</button>
            </>
          )}
        </>
      )}
    </div>
  );
};
