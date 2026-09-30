import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { isEnglishHosting, spokenMetadata } from "../src/hosting-language.js";
import { hostingLine } from "../src/model.js";
import { Radio } from "../src/radio.js";
import { fixtureApp, FixtureTts, temporaryDirectory } from "./helpers.js";
import { loadConfig } from "../src/config.js";
import { ProgrammeSelector } from "../src/model.js";

test("spoken script boundary allows Latin names but rejects mixed and hidden non-Latin letters", () => {
  for (const text of ["Here is a song by Beyoncé.", "Let's keep the music flowing — one more song.", "Café, déjà vu."]) assert(isEnglishHosting(text));
  for (const text of ["Hello 中文", "Here is あの曲", "Artist: Артист", "", "<speak>Hello</speak>"]) assert(!isEnglishHosting(text));
  assert.equal(spokenMetadata("English (中文版)"), undefined);
  assert.equal(spokenMetadata("莫文蔚 Karen Mok"), undefined);
});

test("restart repairs stored mixed-language hosting and drops old DJ audio while retaining queue and catalogue", async () => {
  const directory = await temporaryDirectory(); const app = fixtureApp(directory);
  try {
    const track = { id: "101", title: "慢慢喜欢你", artist: "莫文蔚", source: "netease" as const };
    const old = { id: "a".repeat(64), text: "Here is 慢慢喜欢你 by 莫文蔚.", voice: app.services.radio.settings().voice, language: "en", status: "tts_ready", audioUrl: `/api/audio/${"a".repeat(64)}`, createdAt: new Date().toISOString() };
    app.services.store.set("radio", { status: "playing", items: [{ id: "stored", track, requestedBy: "model", status: "resolved", hosting: old.text, dj: old }], index: 0, title: "An evening", updatedAt: new Date().toISOString() });
    const config = loadConfig({ EMILY_DATA_DIR: directory, EMILY_TTS_ENABLED: "false" });
    const radio = new Radio(config, app.services.store, app.services.music, new ProgrammeSelector(config), new FixtureTts(directory), Date.now);
    const now = radio.now();
    assert.equal(now.status, "paused"); assert.equal(now.dj, undefined);
    assert.equal(now.track?.title, track.title); assert.equal(now.track?.artist, track.artist); assert.equal(now.queue.length, 1);
    const state = app.services.store.get<{ items: { hosting: string; dj?: unknown }[] }>("radio")!;
    assert.equal(state.items[0]!.hosting, hostingLine(track)); assert.equal(state.items[0]!.dj, undefined);
    await radio.close();
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
