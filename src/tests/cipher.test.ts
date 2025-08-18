import { beforeAll, expect, it } from "vitest";
import initKaspaWasm, { initConsolePanicHook } from "kaspa-wasm";
import initCipherWasm, { EncryptedMessage } from "cipher";

beforeAll(async () => {
  await Promise.all([initKaspaWasm(), initCipherWasm()]);
});

it("test cipher", async () => {
  expect(1 + 1 === 2, "ok");

  const encryptedMessage = new EncryptedMessage("sdfsdf");

  expect(encryptedMessage instanceof EncryptedMessage);
});
