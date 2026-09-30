import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { temporaryDirectory, cleanup, ORIGIN } from "./helpers.js";

test("provider and TTS preparation outlives a short idle-socket limit without dropping inbound body bounds", async () => {
  const directory = await temporaryDirectory();
  const app = buildApp({ env: { EMILY_DATA_DIR: directory, EMILY_PUBLIC_ORIGIN: ORIGIN, EMILY_TTS_ENABLED: "false" } });
  try {
    assert.equal(app.initialConfig.connectionTimeout, 150_000);
    assert.equal(app.server.requestTimeout, 30_000);
    assert.equal(app.initialConfig.bodyLimit, 16_384);
  } finally { await cleanup(app, directory); }
});
