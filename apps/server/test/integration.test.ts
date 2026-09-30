import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { cleanup, COOKIE_SENTINEL, fixtureApp, FixtureTts, headers, HttpFixture, login, temporaryDirectory } from "./helpers.js";

test("real configured HTTP fixture: playlists/search, playable queue, pause/navigation, history and preferences persist", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  provider.preview.add(303);
  const env = { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL };
  let app = fixtureApp(directory, env, { tts: new FixtureTts(directory, true) });
  try {
    const cookie = await login(app);
    const setup = await app.inject({ url: "/api/setup", headers: headers(cookie) });
    assert.equal(setup.json().data.music.connected, true);
    assert.equal(setup.json().data.music.user.id, "900");
    assert(!setup.body.includes(COOKIE_SENTINEL));
    assert.equal((await app.inject({ url: "/api/music/playlists", headers: headers(cookie) })).json().data.items[0].id, "700");
    assert.equal((await app.inject({ url: "/api/music/search?q=fixture", headers: headers(cookie) })).json().data.items.length, 3);
    assert.equal((await app.inject({ method: "PATCH", url: "/api/settings", headers: headers(cookie), payload: { volume: 0.4, mood: "Calm", voice: "en-GB-SoniaNeural" } })).statusCode, 200);
    const programme = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { playlistId: "700", limit: 2 } });
    assert.equal(programme.statusCode, 200, programme.body);
    const data = programme.json().data;
    assert.equal(data.selectionSource, "playlist"); assert(data.warnings.some((warning: string) => warning.includes("No model")));
    assert(data.warnings.some((warning: string) => warning.includes("excluded")));
    assert.equal(data.now.track.id, "101"); assert.equal(data.now.status, "paused"); assert.equal(data.now.dj.language, "en");
    assert.equal(data.now.dj.status, "tts_ready"); assert.equal(data.now.dj.voice, "en-GB-SoniaNeural");
    assert.equal(data.now.track.audioUrl, "/api/media/track/101");
    assert.equal(data.now.positionMs, undefined);
    assert.deepEqual(data.now.queue.map((item: { track: { id: string } }) => item.track.id), ["101", "202"]);
    let action = await app.inject({ method: "POST", url: "/api/player/play", headers: headers(cookie) });
    assert.equal(action.json().data.now.status, "playing");
    action = await app.inject({ method: "POST", url: "/api/player/pause", headers: headers(cookie) });
    assert.equal(action.json().data.now.status, "paused");
    action = await app.inject({ method: "POST", url: "/api/player/next", headers: headers(cookie) });
    assert.equal(action.json().data.now.track.id, "202"); assert.equal(action.json().data.now.status, "paused");
    assert.equal(action.json().data.now.dj.status, "tts_ready");
    action = await app.inject({ method: "POST", url: "/api/player/previous", headers: headers(cookie) });
    assert.equal(action.json().data.now.track.id, "101");
    assert.equal(app.services.store.feedbackMap().size, 0, "skips are not dislikes");
    for (const [trackId, kind] of [["101", "less_like_this"], ["202", "like"]]) {
      assert.equal((await app.inject({ method: "POST", url: "/api/feedback", headers: headers(cookie), payload: { trackId, kind } })).statusCode, 200);
    }
    assert.equal((await app.inject({ url: "/api/history", headers: headers(cookie) })).json().data.items.length, 1);
    await app.close(); app = fixtureApp(directory, env, { tts: new FixtureTts(directory, true) });
    assert.equal((await app.inject({ url: "/api/session", headers: { cookie } })).json().data.authenticated, true);
    const settings = (await app.inject({ url: "/api/settings", headers: headers(cookie) })).json().data;
    assert.equal(settings.volume, 0.4); assert.equal(settings.voice, "en-GB-SoniaNeural");
    assert.equal((await app.inject({ url: "/api/now", headers: headers(cookie) })).json().data.status, "paused");
    const second = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } });
    assert.equal(second.statusCode, 200, second.body);
    assert.deepEqual(second.json().data.now.queue.map((item: { track: { id: string } }) => item.track.id), ["202"]);
    assert.equal((await app.inject({ url: "/api/history", headers: headers(cookie) })).json().data.items.length, 2);
    const urlRequests = provider.requests.filter(request => request.path === "/song/url/v1");
    assert(urlRequests.length >= 2);
    for (const request of urlRequests) { assert.equal(request.body.unblock, "false"); assert.equal(request.body.level, "standard"); assert.equal(request.body.cookie, COOKIE_SENTINEL); }
    for (const request of provider.requests) { assert.equal(request.body.noCookie, true); assert(!request.path.includes(COOKIE_SENTINEL)); }
    if (process.platform !== "win32") {
      // POSIX mode bits are not Windows ACLs; encryption/redaction assertions still run everywhere.
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
      assert.equal((await stat(join(directory, "emily.sqlite"))).mode & 0o777, 0o600);
    }
    assert(!(await readFile(join(directory, "emily.sqlite"))).includes(Buffer.from(COOKIE_SENTINEL)), "environment cookies are never persisted in plaintext");
  } finally { await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true }); }
});

test("owner-scoped, expiring QR login stores encrypted authorization and disconnect survives restart", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  let now = Date.now(); const env = { EMILY_NETEASE_API_BASE: provider.base };
  let app = fixtureApp(directory, env, { clock: () => now });
  try {
    const cookie = await login(app), otherSession = await login(app);
    const qr = await app.inject({ method: "POST", url: "/api/music/login/qr", headers: headers(cookie) });
    assert.equal(qr.statusCode, 200, qr.body);
    const key = qr.json().data.key;
    assert(/^[a-f0-9]{64}$/.test(key)); assert(qr.json().data.qrImageUrl.startsWith("data:image/png;base64,"));
    const differentOwnerSession = await app.inject({ url: `/api/music/login/qr/${key}`, headers: headers(otherSession) });
    assert.equal(differentOwnerSession.statusCode, 404);
    const url = `/api/music/login/qr/${key}`;
    let result = await app.inject({ url, headers: headers(cookie) }); assert.equal(result.json().data.status, "waiting");
    provider.qrCode = 802; now += 2001;
    result = await app.inject({ url, headers: headers(cookie) }); assert.equal(result.json().data.status, "scanned");
    provider.qrCode = 803; now += 2001;
    result = await app.inject({ url, headers: headers(cookie) }); assert.equal(result.json().data.status, "connected");
    assert(!result.body.includes(COOKIE_SENTINEL)); assert.equal(result.headers["set-cookie"], undefined);
    assert(!(await readFile(join(directory, "emily.sqlite"))).includes(Buffer.from(COOKIE_SENTINEL)));
    await app.close(); app = fixtureApp(directory, env, { clock: () => now });
    const restored = await app.inject({ url: "/api/setup", headers: headers(cookie) });
    assert.equal(restored.json().data.music.connected, true, restored.body);
    assert(provider.requests.some(request => request.path === "/login/status" && request.body.cookie === COOKIE_SENTINEL));
    const secondQr = await app.inject({ method: "POST", url: "/api/music/login/qr", headers: headers(cookie) });
    assert.equal(secondQr.statusCode, 200); now += 180_001;
    assert.equal((await app.inject({ url: `/api/music/login/qr/${secondQr.json().data.key}`, headers: headers(cookie) })).json().data.status, "expired");
    const disconnected = await app.inject({ method: "POST", url: "/api/music/disconnect", headers: headers(cookie) });
    assert.equal(disconnected.statusCode, 200); assert.equal(disconnected.json().data.music.connected, false);
    await app.close(); app = fixtureApp(directory, { ...env, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { clock: () => now });
    assert.equal((await app.inject({ url: "/api/setup", headers: headers(cookie) })).json().data.music.connected, false, "explicit disconnect overrides supplied env cookie until reconnection");
    assert.deepEqual((await app.inject({ url: "/api/queue", headers: headers(cookie) })).json().data.items, []);
  } finally { await app.close(); await provider.close(); await rm(directory, { recursive: true, force: true }); }
});

test("QR fails closed without encryption key and source remains disconnected without authorization", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_CREDENTIAL_KEY: "" });
  try {
    const cookie = await login(app);
    const qr = await app.inject({ method: "POST", url: "/api/music/login/qr", headers: headers(cookie) });
    assert.equal(qr.statusCode, 503); assert.equal(qr.json().error.code, "CREDENTIAL_STORAGE_UNCONFIGURED");
    assert.equal((await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: {} })).json().error.code, "MUSIC_LOGIN_REQUIRED");
    assert.equal(provider.requests.length, 0);
  } finally { await cleanup(app, directory); await provider.close(); }
});

test("provider failures, malformed responses, timeouts and expired accounts stay honest and redact raw errors", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL, EMILY_HTTP_TIMEOUT_MS: "150" });
  try {
    const cookie = await login(app);
    provider.failPath = "/user/playlist";
    let response = await app.inject({ url: "/api/music/playlists", headers: headers(cookie) });
    assert.equal(response.statusCode, 502); assert(!response.body.includes(COOKIE_SENTINEL)); assert.equal(response.json().error.code, "PROVIDER_UNAVAILABLE");
    provider.failPath = undefined; provider.malformedPath = "/cloudsearch";
    response = await app.inject({ url: "/api/music/search?q=fixture", headers: headers(cookie) });
    assert.equal(response.statusCode, 502); assert(!response.body.includes(COOKIE_SENTINEL));
    provider.malformedPath = undefined; provider.hangPath = "/cloudsearch";
    response = await app.inject({ url: "/api/music/search?q=fixture", headers: headers(cookie) });
    assert.equal(response.statusCode, 502); assert.equal(response.json().error.code, "PROVIDER_TIMEOUT");
    provider.hangPath = undefined;
    const empty = await app.inject({ url: "/api/now", headers: headers(cookie) }); assert.deepEqual(empty.json().data.queue, []);
    provider.preview.add(101); provider.preview.add(202); provider.preview.add(303);
    response = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: {} });
    assert.equal(response.statusCode, 409); assert.equal(response.json().error.code, "NO_PLAYABLE_TRACKS");
  } finally { await cleanup(app, directory); await provider.close(); }
  const secondDirectory = await temporaryDirectory(); provider.statusCode = 301; await provider.start();
  const secondApp = fixtureApp(secondDirectory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL });
  try {
    const cookie = await login(secondApp);
    const status = await secondApp.inject({ url: "/api/setup", headers: headers(cookie) });
    assert.equal(status.json().data.music.connected, false); assert(!status.body.includes(COOKIE_SENTINEL));
    assert.equal((await secondApp.inject({ url: "/api/music/playlists", headers: headers(cookie) })).json().error.code, "MUSIC_LOGIN_REQUIRED");
  } finally { await cleanup(secondApp, secondDirectory); await provider.close(); }
});

test("OAI-compatible HTTP selection stays inside playable IDs; invented IDs/duplicates/biographies fall back", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  const app = fixtureApp(directory, {
    EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL,
    EMILY_MODEL_BASE_URL: `${provider.base}v1`, EMILY_MODEL_API_KEY: "fixture-model-key", EMILY_MODEL_NAME: "fixture-model"
  });
  try {
    const cookie = await login(app);
    let response = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2, prompt: "An unhurried evening" } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.selectionSource, "model"); assert.equal(response.json().data.now.track.id, "202");
    assert(!response.body.includes("fixture-model-key")); assert(!response.body.includes(COOKIE_SENTINEL));
    assert.equal(provider.requests.find(request => request.path === "/v1/chat/completions")?.authorization, "Bearer fixture-model-key");
    for (const mode of ["invented", "duplicate", "biography", "unavailable"] as const) {
      provider.modelMode = mode;
      response = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } });
      assert.equal(response.statusCode, 200, mode + response.body);
      assert.equal(response.json().data.selectionSource, "playlist"); assert(response.json().data.warnings.length > 0);
      assert(!response.body.includes("999999")); assert(!response.body.includes("born in 1974")); assert(!response.body.includes(COOKIE_SENTINEL));
      assert.deepEqual(response.json().data.now.queue.map((item: { track: { id: string } }) => item.track.id), ["101", "202"]);
    }
  } finally { await cleanup(app, directory); await provider.close(); }
});
