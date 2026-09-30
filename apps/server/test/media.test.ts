import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { isPublicAddress, providerMediaUrl, validateRange, openProviderMedia } from "../src/media.js";
import { cleanup, COOKIE_SENTINEL, fixtureApp, FixtureTts, headers, HttpFixture, login, temporaryDirectory } from "./helpers.js";

test("media allowlist rejects SSRF, credentials, ports, deceptive suffixes and private addresses", async () => {
  for (const url of ["http://127.0.0.1/private", "https://169.254.169.254/", "file:///etc/passwd", "https://music.126.net.evil.example/a", "https://user:secret@m1.music.126.net/a", "https://m1.music.126.net:8443/a", "https://m1.music.126.net/a#private", "https://kuwo.example/a"]) {
    assert.equal(providerMediaUrl(url), undefined, url);
  }
  assert.equal(providerMediaUrl("http://m701.music.126.net/song.mp3"), "https://m701.music.126.net/song.mp3");
  for (const address of ["127.0.0.1", "10.1.1.1", "169.254.169.254", "172.16.0.1", "192.168.0.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2002:7f00:1::", "2001:db8::1"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true); assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  await assert.rejects(openProviderMedia("https://evil.example/a", undefined), (error: { code?: string }) => error.code === "UNSAFE_MEDIA_URL");
  for (const range of ["bytes=1-0", "bytes=-0", "bytes=0-1,4-5", "bytes=a-b", "items=1-2", "bytes=0-9999999999999", "bytes=0-\r\nHost: evil"]) assert.throws(() => validateRange(range));
  assert.equal(validateRange("bytes=10-"), "bytes=10-");
});

test("generated audio is authenticated, single-Range capable and cannot traverse or follow symlinks", async () => {
  const directory = await temporaryDirectory(); const audio = new FixtureTts(directory, true); const app = fixtureApp(directory, {}, { tts: audio });
  try {
    const segment = await audio.segment("Test-only audio route fixture", "en-US-EmmaMultilingualNeural");
    const url = segment.audioUrl!;
    assert.equal((await app.inject(url)).statusCode, 401);
    const cookie = await login(app);
    const full = await app.inject({ url, headers: headers(cookie) });
    assert.equal(full.statusCode, 200); assert.equal(full.headers["content-type"], "audio/mpeg");
    const part = await app.inject({ url, headers: { ...headers(cookie), range: "bytes=10-19" } });
    assert.equal(part.statusCode, 206); assert.equal(part.rawPayload.length, 10);
    assert.deepEqual(part.rawPayload, full.rawPayload.subarray(10, 20));
    assert.equal(part.headers["content-range"], `bytes 10-19/${full.rawPayload.length}`);
    const suffix = await app.inject({ url, headers: { ...headers(cookie), range: "bytes=-8" } });
    assert.equal(suffix.statusCode, 206); assert.deepEqual(suffix.rawPayload, full.rawPayload.subarray(-8));
    const head = await app.inject({ method: "HEAD", url, headers: headers(cookie) });
    assert.equal(head.statusCode, 200); assert.equal(head.rawPayload.length, 0); assert.equal(Number(head.headers["content-length"]), full.rawPayload.length);
    const outside = await app.inject({ url, headers: { ...headers(cookie), range: "bytes=99999-" } });
    assert.equal(outside.statusCode, 416); assert.equal(outside.headers["content-range"], `bytes */${full.rawPayload.length}`);
    assert.equal((await app.inject({ url, headers: { ...headers(cookie), range: "bytes=0-4,10-15" } })).statusCode, 416);
    for (const invalid of ["/api/audio/..%2Femily.sqlite", "/api/audio/%2e%2e", "/api/audio/" + "f".repeat(64) + "?path=../emily.sqlite", "/api/audio/" + "e".repeat(64)]) {
      const response = await app.inject({ url: invalid, headers: headers(cookie) });
      assert([400, 404].includes(response.statusCode), `${invalid}: ${response.statusCode}`);
      assert(!response.body.includes("SQLite format"));
    }
    const linkId = "b".repeat(64); await symlink(join(directory, "emily.sqlite"), join(audio.audioDir, `${linkId}.mp3`), "file");
    assert.equal((await app.inject({ url: `/api/audio/${linkId}`, headers: headers(cookie) })).statusCode, 404);
  } finally { await cleanup(app, directory); }
});

test("same-origin track proxy passes Range only, drops provider cookies and never accepts arbitrary URLs", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); await provider.start();
  const calls: { url: string; range: string | undefined }[] = [];
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, {
    mediaOpener: async (url, range) => {
      calls.push({ url, range });
      return { status: range ? 206 : 200, headers: { "content-type": "audio/mpeg", "content-length": "4", ...(range ? { "content-range": "bytes 0-3/20" } : {}), "set-cookie": "must-not-leak", location: "https://evil.example" }, stream: Readable.from([Buffer.from("TEST")]) };
    }
  });
  try {
    assert.equal((await app.inject("/api/media/track/101")).statusCode, 401);
    const cookie = await login(app);
    assert.equal((await app.inject({ url: "/api/media/track/999", headers: headers(cookie) })).statusCode, 404);
    const programme = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } }); assert.equal(programme.statusCode, 200, programme.body);
    const result = await app.inject({ url: "/api/media/track/101", headers: { ...headers(cookie), range: "bytes=0-3" } });
    assert.equal(result.statusCode, 206); assert.equal(result.body, "TEST");
    assert.deepEqual(calls, [{ url: "https://m701.music.126.net/test-fixture-101.mp3", range: "bytes=0-3" }]);
    assert.equal(result.headers["set-cookie"], undefined); assert.equal(result.headers.location, undefined);
    assert.equal((await app.inject({ url: "/api/media/track/101?url=http://127.0.0.1", headers: headers(cookie) })).statusCode, 400);
    assert.equal((await app.inject({ url: "/api/media/track/101", headers: { ...headers(cookie), range: "bytes=0-3,5-7" } })).statusCode, 416);
    assert.equal(calls.length, 1);
  } finally { await cleanup(app, directory); await provider.close(); }
});

test("unsafe provider audio fails as unplayable instead of being proxied or replaced with mock music", async () => {
  const directory = await temporaryDirectory(); const provider = new HttpFixture(); provider.unsafeAudio = true; await provider.start();
  let opened = false;
  const app = fixtureApp(directory, { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL }, { mediaOpener: async () => { opened = true; throw new Error("This must not be called"); } });
  try {
    const cookie = await login(app);
    const result = await app.inject({ method: "POST", url: "/api/programme", headers: headers(cookie), payload: { limit: 2 } });
    assert.equal(result.statusCode, 409); assert.equal(result.json().error.code, "NO_PLAYABLE_TRACKS");
    assert(!result.body.includes("127.0.0.1")); assert.equal(opened, false);
  } finally { await cleanup(app, directory); await provider.close(); }
});

test("optional built frontend serves public assets only, never dotfiles, database, source maps or escaped symlinks", async () => {
  const directory = await temporaryDirectory(); const web = join(directory, "web");
  await mkdir(join(web, "assets"), { recursive: true });
  await writeFile(join(web, "index.html"), "<!doctype html><title>Fixture UI</title>");
  await writeFile(join(web, "assets", "main.js"), "/* public fixture */");
  await writeFile(join(web, ".env"), "PRIVATE_FIXTURE");
  await writeFile(join(web, "assets", "main.js.map"), "PRIVATE_FIXTURE_MAP");
  await writeFile(join(directory, "outside.js"), "PRIVATE_OUTSIDE_FIXTURE");
  await symlink(join(directory, "outside.js"), join(web, "assets", "link.js"), "file");
  const app = fixtureApp(directory, { EMILY_WEB_DIST_DIR: web });
  try {
    assert.equal((await app.inject("/")).statusCode, 200); assert.equal((await app.inject("/assets/main.js")).statusCode, 200);
    for (const path of ["/.env", "/%2eenv", "/assets/../.env", "/assets/%2e%2e%2f.env", "/assets/main.js.map", "/emily.sqlite", "/src/index.ts", "/assets/link.js", "/assets/%2e%2e%2foutside.js"]) {
      const result = await app.inject(path);
      assert([400, 404].includes(result.statusCode), `${path}: ${result.statusCode}`); assert(!result.body.includes("PRIVATE_"));
    }
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
