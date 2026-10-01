import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError, post, safeUrl } from "../src/api.ts";

// All responses here are explicitly test-only contract fixtures.
const events = new EventTarget();
globalThis.window = { location: { origin: "https://emily.test", protocol: "https:" }, dispatchEvent: (event) => events.dispatchEvent(event) };
test("API uses same-origin cookies and no-store; success unwraps ApiResponse", async (t) => {
  let captured;
  t.mock.method(globalThis, "fetch", async (path, init) => { captured = { path, init }; return Response.json({ ok: true, data: { testOnly: true } }); });
  assert.deepEqual(await post("/api/test-only", { testOnly: true }), { testOnly: true });
  assert.equal(captured.init.credentials, "same-origin"); assert.equal(captured.init.cache, "no-store");
  assert.equal(captured.init.method, "POST"); assert.equal(captured.init.headers["Content-Type"], "application/json");
});
test("meaningful API failures propagate, unauthorised private calls expire session", async (t) => {
  let expired = 0; const handler = () => expired++; events.addEventListener("emily:session-expired", handler);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error: { code: "OWNER_REQUIRED", message: "TEST ONLY expired" } }, { status: 401 }));
  await assert.rejects(api("/api/now"), (error) => error instanceof ApiError && error.status === 401 && error.code === "OWNER_REQUIRED");
  assert.equal(expired, 1); await assert.rejects(post("/api/login", { password: "test-only-not-a-credential" })); assert.equal(expired, 1);
  events.removeEventListener("emily:session-expired", handler);
});
test("HTML/non-contract success and contradictory HTTP failures are rejected", async (t) => {
  const responses = [new Response("<html>not JSON</html>"), Response.json({ testOnly: true }), Response.json({ ok: true, data: {} }, { status: 500 })];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  for (let i = 0; i < 3; i++) await assert.rejects(api("/api/test-only"), ApiError);
});
test("network messages do not expose raw provider transport errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("TEST ONLY private transport detail"); });
  await assert.rejects(api("/api/test-only"), (error) => !error.message.includes("private transport"));
  await assert.rejects(api("https://external.test/private"), (error) => error.code === "INVALID_PATH");
});
test("programme and provider-backed controls get a bounded preparation budget; ordinary reads remain short", async (t) => {
  const budgets = [];
  t.mock.method(globalThis, "setTimeout", (_fn, ms) => { budgets.push(ms); return 0; });
  t.mock.method(globalThis, "clearTimeout", () => {});
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, data: {} }));
  await post("/api/programme", {}); await post("/api/player/next"); await post("/api/conversation", {}); await post("/api/queue/add", {}); await post("/api/tts/preview", {}); await api("/api/settings");
  assert.deepEqual(budgets, [135_000, 135_000, 135_000, 135_000, 75_000, 45_000]);
});
test("URL boundary rejects scripting, credentials, mixed content and unsafe image data", () => {
  for (const url of ["javascript:alert(1)", "file:///test-only", "https://owner:secret@example.test/audio", "http://example.test/audio"]) assert.equal(safeUrl(url), undefined);
  assert.equal(safeUrl("/api/audio/test-only"), "https://emily.test/api/audio/test-only");
  assert.equal(safeUrl("data:image/png;base64,AAAA", true), "data:image/png;base64,AAAA");
  assert.equal(safeUrl("data:image/svg+xml,<svg onload='alert(1)'></svg>", true), undefined);
});
