import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import { cleanup, fixtureApp, headers, login, ORIGIN, OWNER_PASSWORD, temporaryDirectory } from "./helpers.js";

test("unconfigured owner fails closed and there is no public registration or fake queue", async () => {
  const directory = await temporaryDirectory();
  const app = buildApp({ env: { EMILY_DATA_DIR: directory, EMILY_PUBLIC_ORIGIN: ORIGIN, EMILY_TTS_ENABLED: "false" } });
  try {
    assert.equal(app.server.listening, false);
    assert.deepEqual((await app.inject("/api/session")).json(), { ok: true, data: { authenticated: false, configured: false } });
    assert.equal((await app.inject("/api/health")).statusCode, 200);
    for (const url of ["/api/now", "/api/queue", "/api/setup", "/api/audio/" + "a".repeat(64)]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 503, url);
      assert.equal(response.json().error.code, "OWNER_AUTH_UNCONFIGURED");
      assert(!response.body.includes("SoundHelix"));
    }
    const response = await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: OWNER_PASSWORD } });
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally { await cleanup(app, directory); }
});

test("owner login, secure HttpOnly cookie, origin policy, logout and real expiry", async () => {
  const directory = await temporaryDirectory();
  let now = Date.now();
  const app = fixtureApp(directory, { EMILY_SESSION_TTL_SECONDS: "300" }, { clock: () => now });
  try {
    assert.equal((await app.inject("/api/settings")).statusCode, 401);
    for (const origin of ["https://evil.example", "null", "https://radio.example.evil", "https://radio.example/"]) {
      const result = await app.inject({ method: "POST", url: "/api/login", headers: { origin }, payload: { password: OWNER_PASSWORD } });
      assert.equal(result.statusCode, 403);
    }
    assert.equal((await app.inject({ method: "POST", url: "/api/login", payload: { password: OWNER_PASSWORD } })).statusCode, 403);
    const signIn = await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: OWNER_PASSWORD } });
    assert.equal(signIn.statusCode, 200);
    const setCookie = String(signIn.headers["set-cookie"]);
    for (const attribute of ["__Host-emily_session=", "HttpOnly", "SameSite=Strict", "Secure", "Path=/", "Max-Age=300"]) assert(setCookie.includes(attribute), attribute);
    assert(!signIn.body.includes(OWNER_PASSWORD));
    assert.deepEqual(signIn.json().data, { authenticated: true, configured: true });
    const cookie = setCookie.split(";")[0]!;
    assert.equal((await app.inject({ url: "/api/session", headers: { cookie } })).json().data.authenticated, true);
    assert.equal((await app.inject({ url: "/api/settings", headers: { cookie, "sec-fetch-site": "cross-site" } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/logout", headers: { cookie, origin: "https://evil.example" } })).statusCode, 403);
    const result = await app.inject({ method: "POST", url: "/api/logout", headers: headers(cookie) });
    assert.equal(result.statusCode, 200);
    assert(String(result.headers["set-cookie"]).includes("Max-Age=0"));
    assert.equal((await app.inject({ url: "/api/settings", headers: { cookie } })).statusCode, 401);
    const secondCookie = await login(app);
    now += 300_001;
    assert.equal((await app.inject({ url: "/api/settings", headers: { cookie: secondCookie } })).statusCode, 401);
    assert.equal((await app.inject({ url: "/api/session", headers: { cookie: secondCookie } })).json().data.authenticated, false);
  } finally { await cleanup(app, directory); }
});

test("bounded login attempts survive restart; password rotation invalidates old sessions", async () => {
  const directory = await temporaryDirectory();
  let now = Date.now();
  let app = fixtureApp(directory, {}, { clock: () => now });
  try {
    for (let index = 0; index < 8; index++) {
      assert.equal((await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: "wrong-fixture-password" } })).statusCode, 401);
    }
    const denied = await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: OWNER_PASSWORD } });
    assert.equal(denied.statusCode, 429);
    assert.equal(denied.headers["retry-after"], "900");
    await app.close(); app = fixtureApp(directory, {}, { clock: () => now });
    assert.equal((await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: OWNER_PASSWORD } })).statusCode, 429);
    now += 900_001;
    const cookie = await login(app);
    await app.close(); app = fixtureApp(directory, { EMILY_OWNER_PASSWORD: "rotated-fixture-password-long" }, { clock: () => now });
    assert.equal((await app.inject({ url: "/api/session", headers: { cookie } })).json().data.authenticated, false);
    assert.equal((await app.inject({ url: "/api/settings", headers: { cookie } })).statusCode, 401);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test("strict input validation rejects unsafe voices, ids, controls, coercions and surplus properties", async () => {
  const directory = await temporaryDirectory(); const app = fixtureApp(directory);
  try {
    const cookie = await login(app);
    const cases = [
      ["PATCH", "/api/settings", { voice: "--write-media=/private" }],
      ["PATCH", "/api/settings", { hostLanguage: "fr" }],
      ["PATCH", "/api/settings", { volume: "0.5" }],
      ["PATCH", "/api/settings", { volume: 1.1 }],
      ["PATCH", "/api/settings", { mood: "bad\ninput" }],
      ["PATCH", "/api/settings", { ownerPassword: "overwrite" }],
      ["POST", "/api/programme", { playlistId: "../cookie" }],
      ["POST", "/api/programme", { trackIds: ["101", "101"] }],
      ["POST", "/api/programme", { limit: 13 }],
      ["POST", "/api/programme", { playlistId: "700", trackIds: ["101"] }],
      ["POST", "/api/programme", { proxy: "http://127.0.0.1" }],
      ["POST", "/api/player/play", { trackId: 101 }],
      ["POST", "/api/feedback", { trackId: "101", kind: "skip" }]
    ] as const;
    for (const [method, url, payload] of cases) {
      const response = await app.inject({ method, url, headers: headers(cookie), payload });
      assert.equal(response.statusCode, 400, `${method} ${url}: ${response.body}`);
      assert.equal(response.json().error.code, "INVALID_INPUT");
    }
    for (const url of ["/api/music/search", "/api/music/search?q=%20", "/api/music/search?q=a&cookie=secret", "/api/now?debug=true"]) {
      assert.equal((await app.inject({ url, headers: headers(cookie) })).statusCode, 400, url);
    }
    const huge = await app.inject({ method: "PATCH", url: "/api/settings", headers: headers(cookie), payload: { mood: "x".repeat(20_000) } });
    assert.equal(huge.statusCode, 413);
    const noSource = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: {} });
    assert.equal(noSource.statusCode, 503); assert.equal(noSource.json().error.code, "MUSIC_SETUP_REQUIRED");
    const state = (await app.inject({ url: "/api/now", headers: headers(cookie) })).json().data;
    assert.equal(state.status, "idle"); assert.deepEqual(state.queue, []); assert.equal(state.track, undefined);
    const status = (await app.inject({ url: "/api/setup", headers: headers(cookie) })).json().data;
    assert.equal(status.music.configured, false); assert.equal(status.music.connected, false);
    assert.equal(status.model.configured, false); assert.equal(status.tts.available, false);
  } finally { await cleanup(app, directory); }
});

test("configured private origins only; no credential-bearing URL or remote plaintext adapter", () => {
  for (const base of ["http://remote.example", "file:///etc/passwd", "https://user:secret@example.com", "https://example.com/?secret=a", "https://example.com/#private"]) {
    assert.throws(() => loadConfig({ EMILY_NETEASE_API_BASE: base }), /Invalid EMILY_NETEASE_API_BASE/);
  }
  assert.equal(loadConfig({ EMILY_NETEASE_API_BASE: "http://127.0.0.1:1234" }).neteaseBase, "http://127.0.0.1:1234/");
  assert.throws(() => loadConfig({ EMILY_CREDENTIAL_KEY: "insecure" }), /EMILY_CREDENTIAL_KEY/);
  assert.throws(() => loadConfig({ EMILY_OWNER_PASSWORD: "short" }), /EMILY_OWNER_PASSWORD/);
  assert.throws(() => loadConfig({ EMILY_TTS_COMMAND: "/bin/sh" }), /EMILY_TTS_COMMAND/);
  for (const command of ["./uvx", "uvx --evil", "C:\\bad\\cmd.exe", "edge-tts.cmd", "/tmp/uvx\n"]) {
    assert.throws(() => loadConfig({ EMILY_TTS_COMMAND: command }), /EMILY_TTS_COMMAND/);
  }
  if (process.platform === "win32") {
    const command = "C:\\Program Files\\tools\\uvx.exe";
    assert.equal(loadConfig({ EMILY_TTS_COMMAND: command }).ttsCommand, command);
  }
});

test("real HTTP loopback health works and imports/factories never listen by accident", async () => {
  const directory = await temporaryDirectory(); const app = fixtureApp(directory);
  try {
    assert.equal(app.server.listening, false);
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address(); assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(response.status, 200); assert.equal((await response.json() as { data: { status: string } }).data.status, "ok");
    const module = await import("../src/index.js"); assert.equal(typeof module.buildApp, "function");
  } finally { await cleanup(app, directory); }
});
