import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import type { DjSegment } from "@emily/shared";
import { Radio } from "../src/radio.js";
import { COOKIE_SENTINEL, FixtureTts, HttpFixture, fixtureApp, headers, login, temporaryDirectory } from "./helpers.js";

// Test-only HTTP/music/TTS fixtures, exercising actual backend state boundaries.
class ObservedTts extends FixtureTts {
  readonly seen: string[] = [];
  override async segment(text: string, voice: string): Promise<DjSegment> {
    this.seen.push(text);
    return super.segment(text, voice);
  }
}
class GatedTts extends FixtureTts {
  started = false;
  private unlock: (() => void) | undefined;
  private pending: Promise<DjSegment> | undefined;
  release() { this.unlock?.(); }
  override async segment(text: string, voice: string): Promise<DjSegment> {
    if (!text.includes("202")) return super.segment(text, voice);
    if (!this.pending) {
      this.started = true;
      this.pending = new Promise<void>(resolve => { this.unlock = resolve; }).then(() => super.segment(text, voice));
    }
    return this.pending;
  }
}

test("upcoming DJ audio is prefetched while the current programme is available", async () => {
  const directory = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const tts = new ObservedTts(directory, true);
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { tts });
  try {
    const cookie = await login(app);
    const response = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } });
    assert.equal(response.statusCode, 200);
    assert(tts.seen.some(text => text.includes("202")), "the next intro should begin preparation before the current track ends");
    // Let short fixture filesystem work settle before closing this test store.
    await new Promise(resolve => setTimeout(resolve, 30));
  } finally { await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true }); }
});

test("owner pause succeeds and stays authoritative while next-track preparation is pending", async () => {
  const directory = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const tts = new GatedTts(directory, true);
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { tts });
  let moving: Promise<{ statusCode: number; json(): any }> | undefined;
  try {
    const cookie = await login(app);
    assert.equal((await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: "/api/player/play", headers: headers(cookie) })).statusCode, 200);
    moving = app.inject({ method: "POST", url: "/api/player/next", headers: headers(cookie) }).then(response => response);
    for (let i = 0; i < 100 && !tts.started; i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert(tts.started);
    const paused = await app.inject({ method: "POST", url: "/api/player/pause", headers: headers(cookie) });
    assert.equal(paused.statusCode, 200, "a pause must not be rejected merely because preparation is busy");
    assert.equal((await app.inject({ method: "POST", url: "/api/player/previous", headers: headers(cookie) })).statusCode, 409, "other preparation actions remain exclusive");
    tts.release();
    const resolved = await moving;
    assert.equal(resolved.statusCode, 200);
    assert.equal(resolved.json().data.now.status, "paused");
    assert.equal((await app.inject({ url: "/api/now", headers: headers(cookie) })).json().data.status, "paused");
  } finally {
    tts.release(); if (moving) await moving;
    await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true });
  }
});

class ManualTts extends FixtureTts {
  readonly calls: { text: string; voice: string; release(): void }[] = [];
  override segment(text: string, voice: string): Promise<DjSegment> {
    return new Promise(resolve => {
      this.calls.push({ text, voice, release: () => resolve({ id: "a".repeat(64), text, voice, language: "en", status: "text_only", createdAt: new Date().toISOString() }) });
    });
  }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const until = async (condition: () => boolean) => {
  for (let i = 0; i < 200 && !condition(); i++) await tick();
  assert(condition(), "fixture operation did not reach its expected boundary");
};

test("pause wins over an in-flight play, not only next", async () => {
  const directory = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const tts = new GatedTts(directory, true);
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { tts });
  let playing: ReturnType<Radio["play"]> | undefined;
  try {
    await app.services.radio.programme({ limit: 2 });
    playing = app.services.radio.play("202");
    await until(() => tts.started);
    await app.services.radio.pause();
    tts.release();
    assert.equal((await playing).now.status, "paused");
  } finally {
    tts.release(); if (playing) await playing;
    await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true });
  }
});

test("lookahead is bounded, reused by navigation, and ignores clear/replaced programmes", async () => {
  const directory = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const tts = new ManualTts(directory);
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { tts });
  const radio = app.services.radio;
  try {
    const first = radio.programme({ limit: 3 });
    await until(() => tts.calls.length === 1); tts.calls[0]!.release(); await first;
    await until(() => tts.calls.length === 2);
    assert(tts.calls[1]!.text.includes("202"));
    assert(!tts.calls.some(call => call.text.includes("303")), "only one upcoming intro is prepared");
    const moving = radio.move(1);
    await tick();
    assert.equal(tts.calls.length, 2, "navigation joins the same pending synthesis");
    tts.calls[1]!.release(); await moving;
    await until(() => tts.calls.length === 3);
    radio.clear();
    tts.calls[2]!.release(); await tick();
    assert.equal(radio.now().queue.length, 0);
    const second = radio.programme({ trackIds: ["101"], limit: 1 });
    await until(() => tts.calls.length === 4); tts.calls[3]!.release(); await second;
    assert.equal(radio.now().track?.id, "101");
    assert.equal(radio.now().queue.length, 1);
    await tick(); assert.equal(tts.calls.length, 4);
  } finally {
    for (const call of tts.calls) call.release();
    await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true });
  }
});

test("voice changes invalidate late intros, while close drains without scheduling more work", async () => {
  const directory = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const tts = new ManualTts(directory);
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { tts });
  const radio = app.services.radio;
  try {
    const programme = radio.programme({ limit: 3 });
    await until(() => tts.calls.length === 1); tts.calls[0]!.release(); await programme;
    await until(() => tts.calls.length === 2);
    radio.updateSettings({ voice: "en-GB-SoniaNeural" });
    assert.equal(radio.now().dj, undefined, "old voice is not exposed after settings change");
    await until(() => tts.calls.length === 3);
    assert.equal(tts.calls[2]!.voice, "en-GB-SoniaNeural");
    tts.calls[1]!.release(); await tick();
    const moving = radio.move(1); tts.calls[2]!.release();
    assert.equal((await moving).now.dj?.voice, "en-GB-SoniaNeural");
    await until(() => tts.calls.length === 4);
    let closed = false;
    const closing = app.close().then(() => { closed = true; });
    await tick(); assert.equal(closed, false, "shutdown drains pending synthesis");
    tts.calls[3]!.release(); await closing;
    await tick(); assert.equal(tts.calls.length, 4, "no jobs scheduled after shutdown");
  } finally {
    for (const call of tts.calls) call.release();
    await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true });
  }
});
