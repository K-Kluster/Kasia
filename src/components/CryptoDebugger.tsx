import { FC, useState } from "react";
import { useWalletStore } from "../store/wallet.store";
import { encrypt_message, decrypt_message, EncryptedMessage } from "cipher";
import { WalletStorage } from "../utils/wallet-storage";

export const CryptoDebugger: FC = () => {
  const walletStore = useWalletStore();
  const [testMessage, setTestMessage] = useState(
    "Hello, this is a test message."
  );
  const [encryptedHex, setEncryptedHex] = useState("");
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog((prev) => [
      ...prev,
      `${new Date().toISOString().substring(11, 19)}: ${message}`,
    ]);
  };

  const handleTestEncryption = async () => {
    if (!walletStore.address) {
      setError("No wallet address available");
      return;
    }

    setError("");
    setEncryptedHex("");
    setDecryptedMessage("");
    setLog([]);

    try {
      addLog(`Using address: ${walletStore.address.toString()}`);

      // Encrypt the message
      addLog("Encrypting message...");
      const encrypted = await encrypt_message(
        walletStore.address.toString(),
        testMessage
      );

      const hex = encrypted.to_hex();
      setEncryptedHex(hex);
      addLog(`Message encrypted successfully: ${hex.substring(0, 20)}...`);

      return hex;
    } catch (err: any) {
      const errorMsg = `Encryption error: ${err.message || err}`;
      setError(errorMsg);
      addLog(errorMsg);
      return null;
    }
  };

  const handleTestDecryption = async (hexToDecrypt?: string) => {
    if (!walletStore.unlockedWallet) {
      setError("No unlocked wallet available");
      return;
    }

    const hexToUse = hexToDecrypt || encryptedHex;
    if (!hexToUse) {
      setError("No encrypted message to decrypt");
      return;
    }

    try {
      addLog("Preparing to decrypt message...");

      // Get private key using WalletStorage
      const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
        walletStore.unlockedWallet,
        walletStore.unlockedWallet.password
      );

      const privateKey = privateKeyGenerator.receiveKey(0);
      addLog("Retrieved private key for decryption");

      // Create encrypted message object from hex
      const encryptedMessage = new EncryptedMessage(hexToUse);
      addLog("Created EncryptedMessage object from hex");

      // Decrypt
      addLog("Attempting decryption...");
      const decrypted = await decrypt_message(encryptedMessage, privateKey);

      setDecryptedMessage(decrypted);
      addLog(`Decryption successful: "${decrypted}"`);
    } catch (err: any) {
      const errorMsg = `Decryption error: ${err.message || err}`;
      setError(errorMsg);
      addLog(errorMsg);
    }
  };

  const handleTestFullCycle = async () => {
    const encryptedHex = await handleTestEncryption();
    if (encryptedHex) {
      await handleTestDecryption(encryptedHex);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#2d3748",
        color: "#e2e8f0",
        borderRadius: "8px",
        margin: "20px 0",
      }}
    >
      <h2 style={{ color: "#90cdf4" }}>Encryption/Decryption Debugger</h2>

      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ color: "#90cdf4", marginTop: 0 }}>
          How Decryption Works:
        </h3>
        <ol style={{ padding: "0 0 0 20px", margin: 0 }}>
          <li>
            We use your wallet's private key to decrypt messages sent to your
            address
          </li>
          <li>
            The decryption process needs the ephemeral public key and nonce from
            the encrypted message
          </li>
          <li>
            A shared secret is derived using your private key and the sender's
            ephemeral public key
          </li>
          <li>
            This shared secret is used to decrypt the message with
            ChaCha20Poly1305
          </li>
        </ol>
      </div>

      {!walletStore.unlockedWallet && (
        <div
          style={{
            background: "#4a5568",
            color: "#fbd38d",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          Please unlock your wallet first to use this tool.
        </div>
      )}

      <div>
        <div style={{ marginBottom: "15px" }}>
          <label
            htmlFor="testMessage"
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
              color: "#90cdf4",
            }}
          >
            Test Message:
          </label>
          <textarea
            id="testMessage"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #4a5568",
              borderRadius: "4px",
              background: "#3a4556",
              color: "#e2e8f0",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={handleTestEncryption}
            disabled={!walletStore.address}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: "#4299e1",
              color: "white",
              opacity: !walletStore.address ? "0.5" : "1",
            }}
          >
            Test Encryption
          </button>

          <button
            onClick={() => handleTestDecryption()}
            disabled={!walletStore.unlockedWallet || !encryptedHex}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: "#718096",
              color: "white",
              opacity:
                !walletStore.unlockedWallet || !encryptedHex ? "0.5" : "1",
            }}
          >
            Test Decryption
          </button>

          <button
            onClick={handleTestFullCycle}
            disabled={!walletStore.unlockedWallet || !walletStore.address}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: "#48bb78",
              color: "white",
              opacity:
                !walletStore.unlockedWallet || !walletStore.address
                  ? "0.5"
                  : "1",
            }}
          >
            Test Full Cycle
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#4a2731",
            color: "#feb2b2",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <div>
        {encryptedHex && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#90cdf4" }}>Encrypted Message (hex):</h3>
            <div
              style={{
                background: "#3a4556",
                padding: "10px",
                border: "1px solid #4a5568",
                borderRadius: "4px",
                wordBreak: "break-all",
                marginBottom: "10px",
                color: "#e2e8f0",
              }}
            >
              {encryptedHex}
            </div>
          </div>
        )}

        {decryptedMessage && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#90cdf4" }}>Decrypted Message:</h3>
            <div
              style={{
                background: "#3a4556",
                padding: "10px",
                border: "1px solid #4a5568",
                borderRadius: "4px",
                wordBreak: "break-all",
                marginBottom: "10px",
                color: "#e2e8f0",
              }}
            >
              {decryptedMessage}
            </div>

            <div>
              {decryptedMessage === testMessage ? (
                <span
                  style={{
                    color: "#9ae6b4",
                    fontWeight: "bold",
                  }}
                >
                  ✓ Decryption successful - messages match!
                </span>
              ) : (
                <span
                  style={{
                    color: "#feb2b2",
                    fontWeight: "bold",
                  }}
                >
                  ✗ Decryption produced different message!
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          background: "#1a202c",
          color: "#a0aec0",
          padding: "10px",
          borderRadius: "4px",
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        <h3 style={{ color: "#90cdf4", margin: "0 0 10px 0" }}>Debug Log:</h3>
        <pre style={{ margin: 0, fontFamily: "monospace" }}>
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </pre>
      </div>
    </div>
  );
};
