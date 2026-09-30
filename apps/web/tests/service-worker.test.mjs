import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Test-only service-worker environment; no production mocks or private cache.
async function fixture() {
  const handlers = new Map(), stores = new Map(), fetched = [], writes = [], deleted = [];
  const origin = "https://emily.test";
  const key = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return { put: async (request, response) => { writes.push({ url: key(request), credentials: request.credentials }); stores.get(name).set(key(request), response); }, match: async (request) => stores.get(name).get(key(request))?.clone() };
  };
  const context = {
    self: { location: { origin }, clients: { claim: async () => {} }, addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { open, keys: async () => [...stores.keys()], delete: async (name) => { deleted.push(name); return stores.delete(name); }, match: async (request) => { for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)).clone(); } },
    fetch: async (request) => { fetched.push({ url: key(request), credentials: request.credentials }); return new Response(key(request).endsWith("index.html") ? '<script src="/assets/index-TEST.js"></script><link href="/assets/index-TEST.css">' : "TEST ONLY public asset"); }, URL, Request, Response, Error
  };
  vm.runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  return { handlers, stores, fetched, writes, deleted };
}
test("install caches shell and hashed JS/CSS only, with credentials omitted", async () => {
  const { handlers, fetched, writes } = await fixture();
  let work; handlers.get("install")({ waitUntil: (promise) => { work = promise; } }); await work;
  assert.equal(writes.length, 8); assert.ok(fetched.every((request) => request.credentials === "omit"));
  assert.ok(writes.every((request) => !request.url.includes("/api/") && request.credentials === "omit"));
  assert.ok(writes.some((request) => request.url.endsWith("/assets/index-TEST.js")));
});
test("private API, QR, audio, covers, POST, external URLs and tokenised assets are never intercepted", async () => {
  const { handlers, writes, fetched } = await fixture();
  const urls = ["/api/session", "/api/setup", "/api/music/login/qr/test-only", "/api/audio/test-only", "/song.wav", "/cover.jpg", "/assets/index-TEST.js?secret=test-only", "https://provider.test/audio.mp3"];
  for (const path of urls) handlers.get("fetch")({ request: new Request(new URL(path, "https://emily.test")), respondWith: () => assert.fail(`Private request intercepted: ${path}`) });
  handlers.get("fetch")({ request: new Request("https://emily.test/api/login", { method: "POST" }), respondWith: () => assert.fail("POST intercepted") });
  assert.equal(writes.length, 0); assert.equal(fetched.length, 0);
});
test("public assets are fetched credentialless; activation only prunes our own old caches", async () => {
  const { handlers, stores, fetched, deleted } = await fixture();
  let response; handlers.get("fetch")({ request: new Request("https://emily.test/assets/index-TEST.js"), respondWith: (promise) => { response = promise; } });
  assert.equal((await response).status, 200); assert.equal(fetched[0].credentials, "omit");
  stores.set("emily-public-shell-old", new Map()); stores.set("another-app-cache", new Map());
  let work; handlers.get("activate")({ waitUntil: (promise) => { work = promise; } }); await work;
  assert.deepEqual(deleted, ["emily-public-shell-old"]); assert.ok(stores.has("another-app-cache"));
});
