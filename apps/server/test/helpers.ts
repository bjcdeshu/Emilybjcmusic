import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { voiceLanguage } from "@emily/shared";
import type { DjSegment } from "@emily/shared";
import { buildApp, type EmilyApp, type AppOptions } from "../src/app.js";
import type { TtsPort } from "../src/tts.js";

// All accounts, songs, cookies and audio bytes in this file are TEST FIXTURES only.
export const OWNER_PASSWORD = "fixture-owner-password-long";
export const COOKIE_SENTINEL = "TEST_ONLY_NETEASE_COOKIE_SENTINEL";
export const ORIGIN = "https://radio.example";
export const FIXTURE_SONGS = [101, 202, 303].map(id => ({ id, name: `Fixture track ${id}`, ar: [{ name: "Fixture artist" }], al: { name: "Fixture album", picUrl: "http://p1.music.126.net/test-fixture-cover" }, dt: 120000 }));
export async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(process.env.TMPDIR || tmpdir(), "emily-backend-test-"));
}
export class FixtureTts implements TtsPort {
  readonly audioDir: string;
  constructor(directory: string, private readonly ready = false) { this.audioDir = join(directory, "audio"); }
  async available(): Promise<boolean> { return this.ready; }
  async segment(text: string, voice: string): Promise<DjSegment> {
    const id = createHash("sha256").update(text + voice).digest("hex");
    if (this.ready) {
      await mkdir(this.audioDir, { recursive: true });
      await writeFile(join(this.audioDir, `${id}.mp3`), Buffer.from("TEST AUDIO FIXTURE BYTES ".repeat(40)), { mode: 0o600 });
    }
    return { id, text, voice, language: voiceLanguage(voice), status: this.ready ? "tts_ready" : "text_only", createdAt: "2026-09-30T00:00:00.000Z", ...(this.ready ? { audioUrl: `/api/audio/${id}` } : {}) };
  }
}
export type CapturedRequest = { path: string; body: Record<string, unknown>; authorization: string | undefined };
export class HttpFixture {
  readonly requests: CapturedRequest[] = [];
  readonly preview = new Set<number>();
  playlistSongs = FIXTURE_SONGS;
  searchSongs = FIXTURE_SONGS;
  detailSongs = FIXTURE_SONGS;
  dialogueTarget: { title: string; artist?: string } | undefined;
  dialogueLimit: number | undefined;
  qrCode = 801;
  statusCode = 200;
  failPath: string | undefined;
  hangPath: string | undefined;
  unsafeAudio = false;
  malformedPath: string | undefined;
  dialogueFormatting = false;
  dialogueMode: "clarify" | "valid" | "invented" | "duplicate" | "mismatch" | undefined;
  hostingText: string | undefined;
  lyricBody: Record<string,unknown> | undefined;
  modelMode: "valid" | "invented" | "duplicate" | "biography" | "unavailable" = "valid";
  readonly server = createServer((request, response) => { void this.respond(request, response); });
  base = "";
  async start(): Promise<void> {
    this.server.listen(0, "127.0.0.1");
    await once(this.server, "listening");
    const address = this.server.address();
    assert(address && typeof address === "object");
    this.base = `http://127.0.0.1:${address.port}/`;
  }
  async close(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) => this.server.close(error => error ? reject(error) : resolve()));
  }
  private async respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>; }
    catch { response.writeHead(400).end(); return; }
    const path = request.url || "";
    this.requests.push({ path, body, authorization: request.headers.authorization });
    if (path === this.hangPath) return;
    if (path === this.failPath) { response.writeHead(503).end(`private provider diagnostic ${COOKIE_SENTINEL}`); return; }
    if (path === this.malformedPath) { response.writeHead(200).end(`not json ${COOKIE_SENTINEL}`); return; }
    let value: unknown;
    if (path === "/login/status") value = { data: { code: this.statusCode, profile: this.statusCode === 200 ? { userId: 900, nickname: "Fixture owner", avatarUrl: "https://p1.music.126.net/test-avatar" } : null }, cookie: COOKIE_SENTINEL };
    else if (path === "/user/playlist") value = { code: 200, playlist: [{ id: 700, name: "Fixture owner playlist", trackCount: this.playlistSongs.length, coverImgUrl: "https://p1.music.126.net/test-cover" }] };
    else if (path === "/playlist/track/all") value = { code: 200, songs: this.playlistSongs.slice(Number(body.offset)||0,(Number(body.offset)||0)+100) };
    else if (path === "/song/detail") value = { code: 200, songs: this.detailSongs.filter(song => String(body.ids).split(",").includes(String(song.id))) };
    else if (path === "/cloudsearch") value = { code: 200, result: { songs: this.searchSongs } };
    else if (path === "/song/url/v1") value = {
      code: 200, data: String(body.id).split(",").map(id => ({ id: Number(id), code: 200, url: this.unsafeAudio ? "http://127.0.0.1/private" : `http://m701.music.126.net/test-fixture-${id}.mp3`, freeTrialInfo: this.preview.has(Number(id)) ? { start: 0, end: 30 } : null, expi: 120 }))
    };
    else if (path === "/lyric") value = this.lyricBody || {code:200,lrc:{lyric:"[00:00.00]TEST LYRIC first\n[00:01.00]TEST LYRIC second\n[00:02.00]TEST LYRIC third"}};
    else if (path === "/login/qr/key") value = { code: 200, data: { unikey: "TEST_FIXTURE_QR_KEY_123456" } };
    else if (path === "/login/qr/create") value = { code: 200, data: { qrurl: `https://music.163.com/login?codekey=${body.key}`, qrimg: "data:image/png;base64,iVBORw0KGgo=" } };
    else if (path === "/login/qr/check") value = { code: this.qrCode, ...(this.qrCode === 803 ? { cookie: COOKIE_SENTINEL } : {}) };
    else if (path === "/v1/chat/completions") {
      const system = String((body.messages as {content:string}[] | undefined)?.[0]?.content || '');
      if (system.includes('HOST_ONE:')) {
        if (this.modelMode === 'unavailable') { response.writeHead(503).end(COOKIE_SENTINEL); return; }
        const input = JSON.parse(String((body.messages as {content:string}[])[1]?.content)) as {track:{title:string;artist:string}};
        const hosting = this.hostingText || `接下来是${input.track.artist}的《${input.track.title}》。这是明确标记的模型测试段落，用来验证完整主持稿与音频的交接，不代表真实用户上下文、实际歌曲评价或正式主持台词。`;
        response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{message:{content:JSON.stringify({hosting})}}]})); return;
      }
      if(this.dialogueMode && system.includes('ONE private radio owner')) {
        const plan={...(this.dialogueTarget?{target:this.dialogueTarget}:{}),...(this.dialogueLimit?{limit:this.dialogueLimit}:{}),reply:this.dialogueFormatting?'我理解了。\n换轻松一点的音乐。':'想听什么样的音乐？',action:this.dialogueMode==='clarify'?'clarify':'find',prompt:'柔和，但不要太伤感',queries:['Fixture artist'],...(this.dialogueFormatting?{playlistId:null}:{})};
        value={choices:[{message:{content:this.dialogueFormatting?'```json\n'+JSON.stringify(plan)+'\n```':JSON.stringify(plan)}}]};
        response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(value));return;
      }
      if(this.dialogueMode && system.includes('Output ONLY JSON')) {
        const ids=this.dialogueMode==='invented'?['999999']:this.dialogueMode==='duplicate'?['101','101']:this.dialogueMode==='mismatch'?[]:['101','202'];
        value={choices:[{message:{content:JSON.stringify({reply:'这些是真实找到的音乐。要不要从这几首开始？',ids})}}]};
        response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(value));return;
      }
      if (this.modelMode === "unavailable") { response.writeHead(503).end(COOKIE_SENTINEL); return; }
      if(this.hostingText) {response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'测试中文节目',selections:[{id:'101',reason:'测试选择',hosting:this.hostingText}]})}}]}));return;}
      const selections = [{ id: "202", transition: "settle_in", reason: "flow" }, { id: "101", transition: "keep_flow", reason: "variety" }];
      if (this.modelMode === "invented") selections[0]!.id = "999999";
      if (this.modelMode === "duplicate") selections[1]!.id = "202";
      if (this.modelMode === "biography") selections[0]!.transition = "The artist was born in 1974 and won awards.";
      value = { choices: [{ message: { content: JSON.stringify({ titleCode: "flow", selections }) } }], privateKey: COOKIE_SENTINEL };
    } else { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": `provider_secret=${COOKIE_SENTINEL}` }).end(JSON.stringify(value));
  }
}
export function fixtureApp(directory: string, extraEnv: NodeJS.ProcessEnv = {}, extraOptions: AppOptions = {}): EmilyApp {
  return buildApp({ env: { EMILY_DATA_DIR: directory, EMILY_OWNER_PASSWORD: OWNER_PASSWORD, EMILY_PUBLIC_ORIGIN: ORIGIN, EMILY_TTS_ENABLED: "false", EMILY_CREDENTIAL_KEY: "0f".repeat(32), ...extraEnv }, tts: new FixtureTts(directory), ...extraOptions });
}
export async function login(app: EmilyApp): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/login", headers: { origin: ORIGIN }, payload: { password: OWNER_PASSWORD } });
  assert.equal(response.statusCode, 200, response.body);
  const cookie = response.headers["set-cookie"];
  assert.equal(typeof cookie, "string");
  return String(cookie).split(";")[0]!;
}
export async function cleanup(app: EmilyApp, directory: string): Promise<void> { await app.close(); await rm(directory, { recursive: true, force: true }); }
export const headers = (cookie: string) => ({ cookie, origin: ORIGIN });
