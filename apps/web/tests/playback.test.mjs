import test from "node:test";
import assert from "node:assert/strict";
import { RadioAudio, formatTime } from "../src/playback.ts";

// Explicit, test-only audio/catalogue fixtures. Never imported by production.
class FakeAudio extends EventTarget {
  src = ""; currentTime = 0; duration = NaN; volume = 1; paused = true; ended = false; error = null;
  played = []; loads = 0; rejection = null; emitPlaying = true;
  load() { this.loads++; this.currentTime = 0; this.duration = NaN; this.ended = false; this.error = null; }
  async play() {
    this.played.push(this.src);
    if (this.rejection) throw this.rejection;
    this.paused = false; this.ended = false;
    if (this.emitPlaying) this.dispatchEvent(new Event("playing"));
  }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
  removeAttribute(name) { if (name === "src") this.src = ""; }
  finish() { this.ended = true; this.paused = true; this.dispatchEvent(new Event("ended")); }
}
const fixture = (id = "test-song-1", dj = true) => ({
  status: "playing", updatedAt: "2026-01-01T00:00:00Z", queue: [],
  track: { id, title: `TEST ONLY ${id}`, artist: "Test fixture", source: "local", audioUrl: `/test-only/${id}.wav` },
  ...(dj ? { dj: { id: `test-dj-${id}`, text: "Test-only hosting fixture.", audioUrl: "/test-only/dj.wav", status: "tts_ready", createdAt: "2026-01-01T00:00:00Z" } } : {})
});
function setup(advance = async () => fixture("test-song-2")) {
  const audio = new FakeAudio(); const changes = []; const resolved = [];
  const player = new RadioAudio(audio, { onChange: (state) => changes.push(state), onResolved: (now) => resolved.push(now), advance, sourceUrl: (url) => url?.startsWith("/test-only/") ? url : undefined });
  return { player, audio, changes, resolved };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("restored server playing is metadata only, never autoplay", () => {
  const { player, audio } = setup(); player.restore(fixture());
  assert.equal(audio.played.length, 0); assert.equal(player.snapshot.status, "paused"); assert.equal(player.snapshot.wantsPlayback, false);
});
test("real ended event: DJ -> song -> one next queue resolution", async () => {
  let advances = 0; const { player, audio } = setup(async () => { advances++; return fixture("test-song-2"); });
  await player.perform(async () => fixture()); await tick();
  assert.equal(player.snapshot.phase, "dj"); assert.equal(player.snapshot.status, "playing");
  audio.finish(); await tick(); assert.equal(player.snapshot.phase, "song"); assert.equal(audio.src, "/test-only/test-song-1.wav");
  audio.finish(); audio.finish(); await tick(); assert.equal(advances, 1); assert.equal(player.current.track.id, "test-song-2"); assert.equal(player.snapshot.phase, "dj");
});
test("pause while next is resolving wins over async autoplay", async () => {
  const { player, audio } = setup(); let resolve;
  const action = player.perform(() => new Promise((r) => { resolve = r; }));
  player.pause(); resolve(fixture()); await action; await tick();
  assert.equal(player.snapshot.status, "paused"); assert.equal(audio.played.length, 0); assert.equal(player.snapshot.wantsPlayback, false);
});
test("later queue action discards a stale response", async () => {
  const { player, resolved } = setup(); let slow;
  const earlier = player.perform(() => new Promise((r) => { slow = r; }));
  await player.perform(async () => fixture("test-song-new")); slow(fixture("test-song-stale")); await earlier;
  assert.equal(player.current.track.id, "test-song-new"); assert.deepEqual(resolved.map((now) => now.track.id), ["test-song-new"]);
});
test("stop/logout cancels late resolution and clears audio", async () => {
  const { player, audio, resolved } = setup(); let late;
  const action = player.perform(() => new Promise((r) => { late = r; }));
  player.stop(); late(fixture()); await action;
  assert.equal(audio.src, ""); assert.equal(player.current, null); assert.equal(resolved.length, 0); assert.equal(player.snapshot.status, "idle");
});
test("pause/resume continues the same source and position, no DJ replay", async () => {
  const { player, audio } = setup(); await player.perform(async () => fixture()); audio.finish(); await tick();
  audio.currentTime = 27; player.pause(); await player.play();
  assert.equal(player.snapshot.phase, "song"); assert.equal(audio.currentTime, 27); assert.equal(audio.played.at(-1), "/test-only/test-song-1.wav");
});
test("autoplay rejection is blocked, not successful playback", async () => {
  const { player, audio } = setup(); audio.rejection = new DOMException("Gesture required", "NotAllowedError");
  await player.perform(async () => fixture()); await tick();
  assert.equal(player.snapshot.status, "blocked"); assert.equal(player.snapshot.wantsPlayback, false); assert.match(player.snapshot.message, /Chrome/);
  audio.rejection = null; await player.play(); assert.equal(player.snapshot.status, "playing");
});
test("a resolved play promise without a playing event does not claim playing", async () => {
  const { player, audio } = setup(); audio.emitPlaying = false;
  await player.perform(async () => fixture()); await tick(); assert.equal(player.snapshot.status, "loading");
});
test("quiet mode skips a live DJ and respects a prior pause", async () => {
  const { player, audio } = setup(); await player.perform(async () => fixture()); player.pause(); const count = audio.played.length;
  player.setDjEnabled(false); assert.equal(player.snapshot.phase, "song"); assert.equal(audio.played.length, count); assert.equal(player.snapshot.status, "paused");
  await player.play(); assert.equal(player.snapshot.phase, "song");
});
test("text-only and failed TTS never pretend to play hosting", async () => {
  for (const status of ["text_only", "tts_pending", "tts_failed"]) {
    const { player, audio } = setup(); const now = fixture(); now.dj.status = status;
    await player.perform(async () => now); assert.equal(player.snapshot.phase, "song"); assert.match(player.snapshot.warning, /语音尚不可用/); assert.equal(audio.played[0], now.track.audioUrl);
  }
});
test("DJ media failure falls back to the actual song with an explicit warning", async () => {
  const { player, audio } = setup(); await player.perform(async () => fixture());
  audio.error = { code: 4 }; audio.dispatchEvent(new Event("error")); await tick();
  assert.equal(player.snapshot.phase, "song"); assert.match(player.snapshot.warning, /播放失败/);
});
test("missing or unsafe track URL yields error and does not spin through the queue", async () => {
  const { player, audio } = setup(); const now = fixture("unplayable", false); now.track.audioUrl = "javascript:alert(1)";
  await player.perform(async () => now); assert.equal(player.snapshot.status, "error"); assert.equal(audio.played.length, 0); assert.equal(audio.src, "");
});
test("progress and seek come only from real audio properties; clamp volume", async () => {
  const { player, audio } = setup(); await player.perform(async () => fixture("song", false));
  audio.duration = 60; audio.currentTime = 18.25; audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(player.snapshot.time, 18.25); assert.equal(player.snapshot.duration, 60);
  player.seek(90); assert.equal(audio.currentTime, 60); player.seek(-5); assert.equal(audio.currentTime, 0);
  player.setVolume(2); assert.equal(audio.volume, 1); player.setVolume(-1); assert.equal(audio.volume, 0); player.setVolume(NaN); assert.equal(audio.volume, 0);
});
test("user pause prevents ended from advancing", async () => {
  let advanced = 0; const { player, audio } = setup(async () => { advanced++; return fixture(); });
  await player.perform(async () => fixture("song", false)); player.pause(); audio.finish(); await tick(); assert.equal(advanced, 0);
});
test("empty queue ends honestly; request errors remain visible", async () => {
  const { player } = setup(); await player.perform(async () => ({ status: "idle", queue: [], updatedAt: "2026-01-01T00:00:00Z" }));
  assert.equal(player.snapshot.wantsPlayback, false); assert.equal(player.snapshot.phase, "idle");
  await player.perform(async () => { throw new Error("TEST ONLY provider unavailable"); });
  assert.equal(player.snapshot.status, "error"); assert.equal(player.snapshot.message, "TEST ONLY provider unavailable");
});
test("stale play rejection after pause/resume cannot override a newer real playing event", async () => {
  const { player, audio } = setup(); let rejectOld;
  audio.play = () => new Promise((_, reject) => { rejectOld = reject; });
  await player.perform(async () => fixture("song", false));
  player.pause();
  audio.play = async () => { audio.paused = false; audio.dispatchEvent(new Event("playing")); };
  await player.play(); rejectOld(new DOMException("TEST ONLY old rejection", "NotAllowedError")); await tick();
  assert.equal(player.snapshot.status, "playing"); assert.equal(player.snapshot.wantsPlayback, true);
});
test("empty restore is ready, and stop clears all previous errors and warnings", async () => {
  const { player } = setup(); player.restore({ status: "idle", queue: [], updatedAt: "2026-01-01T00:00:00Z" });
  assert.equal(player.snapshot.status, "idle"); assert.equal(player.snapshot.message, undefined);
  await player.perform(async () => { throw new Error("TEST ONLY failure"); });
  player.stop(); assert.equal(player.snapshot.status, "idle"); assert.equal(player.snapshot.message, undefined); assert.equal(player.snapshot.warning, undefined);
});

test("enqueue metadata keeps the exact source/time/paused intent; stale programme/track cannot replace current", async()=>{
  const {player,audio}=setup();const now={...fixture('song',false),programmeId:'TEST-programme'};await player.perform(async()=>now);audio.currentTime=18;audio.duration=60;audio.dispatchEvent(new Event('timeupdate'));
  const source=audio.src,loads=audio.loads,played=audio.played.length;
  const update={...now,queue:[{id:'added',track:fixture('added',false).track}],updatedAt:'2026-01-02T00:00:00Z'};
  assert.equal(player.mergeMetadata(update),true);assert.equal(audio.src,source);assert.equal(audio.loads,loads);assert.equal(audio.currentTime,18);assert.equal(audio.played.length,played);assert.equal(player.snapshot.wantsPlayback,true);
  player.pause();assert.equal(player.mergeMetadata({...update,status:'playing'}),true);assert.equal(audio.paused,true);assert.equal(audio.currentTime,18);assert.equal(player.snapshot.wantsPlayback,false);
  assert.equal(player.mergeMetadata({...update,programmeId:'another'}),false);assert.equal(player.mergeMetadata({...update,track:fixture('different',false).track}),false);assert.equal(player.current.track.id,'song');
});
test("same-element voice audition restores source and position PAUSED; ended never advances, stop cancels restore",async()=>{
  let advance=0;const {player,audio}=setup(async()=>{advance++;return fixture('next');});await player.perform(async()=>fixture('song',false));audio.duration=60;audio.currentTime=22;audio.dispatchEvent(new Event('timeupdate'));
  await player.preview('/test-only/audition.wav');assert.equal(audio.src,'/test-only/audition.wav');assert.equal(player.snapshot.phase,'preview');audio.finish();assert.equal(advance,0);assert.equal(audio.src,'/test-only/song.wav');assert.equal(audio.paused,true);assert.equal(player.snapshot.wantsPlayback,false);audio.duration=60;audio.dispatchEvent(new Event('loadedmetadata'));assert.equal(audio.currentTime,22);
  await player.preview('/test-only/audition.wav');player.stop();audio.dispatchEvent(new Event('loadedmetadata'));assert.equal(audio.src,'');assert.equal(player.current,null);
});
test("destroy detaches listeners and formatting handles live/invalid durations", () => {
  const { player, audio, changes } = setup(); player.destroy(); const count = changes.length;
  audio.dispatchEvent(new Event("playing")); assert.equal(changes.length, count);
  assert.equal(formatTime(125.9), "2:05"); assert.equal(formatTime(Infinity), "0:00"); assert.equal(formatTime(-1), "0:00");
});
