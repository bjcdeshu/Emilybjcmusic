import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import type { DjSegment } from "@emily/shared";
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
