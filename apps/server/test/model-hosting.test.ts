import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { Track, RadioSettings } from "@emily/shared";
import { loadConfig } from "../src/config.js";
import { hostingLine, ProgrammeSelector } from "../src/model.js";
import { isEnglishHosting, isHosting } from "../src/hosting-language.js";

// Synthetic catalogue and model replies are explicitly TEST FIXTURES, never production data.
const catalogue: Track[] = [
  { id: "101", title: "Fixture First Song", artist: "Fixture Artist", source: "netease" },
  { id: "202", title: "Fixture Second Song", artist: "Fixture Artist", source: "netease" }
];
const settings: RadioSettings = { hostLanguage: "en", voice: "en-US-EmmaMultilingualNeural", djEnabled: true, discovery: false, mood: "An unhurried drive", volume: 0.5 };
const naturalPlan = () => ({ title: "Somewhere along the way", selections: [
  { id: "202", reason: "A familiar opening before a small change of direction.", hosting: "Hi, it's Emily. There's a little room for music between where you left and where you're going. Let's start with Fixture Second Song." },
  { id: "101", reason: "A second selection to keep the programme moving.", hosting: "We'll let that thought linger for a moment, then make room for Fixture First Song. Stay with the music." }
] });
async function withSelector(plan: unknown, run: (selector: ProgrammeSelector) => Promise<void>) {
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) { /* consume fixture input */ }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address === "object");
  const config = loadConfig({ EMILY_MODEL_BASE_URL: `http://127.0.0.1:${address.port}/v1`, EMILY_MODEL_API_KEY: "TEST_ONLY_MODEL_FIXTURE", EMILY_MODEL_NAME: "fixture-model", EMILY_TTS_ENABLED: "false" });
  try { await run(new ProgrammeSelector(config)); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("model hosting accepts contextual English prose instead of only a fixed phrase menu", async () => {
  const plan = naturalPlan();
  await withSelector(plan, async selector => {
    const result = await selector.select(catalogue, { prompt: "A quiet drive", limit: 2 }, settings, new Map());
    assert.equal(result.source, "model"); assert.equal(result.title, plan.title);
    assert.equal(result.items[0]?.hosting, plan.selections[0]!.hosting);
    assert.equal(result.items[0]?.reason, plan.selections[0]!.reason);
    assert.deepEqual(result.items.map(item => item.track.id), ["202", "101"]);
  });
});

test("English hosting omits non-Latin names without inventing translations; catalogue stays original", async () => {
  const tracks: Track[] = [{ id: "101", title: "慢慢喜欢你", artist: "莫文蔚", source: "netease" }, { id: "202", title: "If", artist: "Bread", source: "netease" }];
  assert(isEnglishHosting(hostingLine(tracks[0]!)));
  assert(!hostingLine(tracks[0]!).includes("慢慢"));
  assert(hostingLine(tracks[1]!).includes("If by Bread"));
  assert(isEnglishHosting(hostingLine({ ...tracks[0]!, title: "Home", artist: "歌手" })));
  for (const hosting of ["Here is 慢慢喜欢你 by 莫文蔚.", "Next: Ｍｏｋ 中文.", "Next up, この曲."]) {
    const plan = naturalPlan(); plan.selections[0]!.hosting = hosting;
    await withSelector(plan, async selector => {
      const result = await selector.select(tracks, { limit: 2 }, settings, new Map());
      assert.equal(result.source, "playlist");
      assert(result.items.every(item => isEnglishHosting(item.hosting)));
      assert.equal(result.items[0]!.track.title, "慢慢喜欢你");
      assert.equal(result.items[0]!.track.artist, "莫文蔚");
    });
  }
  const plan = naturalPlan(); plan.selections[0]!.hosting = "Let's make room for the next song. There is no need to rush this evening.";
  await withSelector(plan, async selector => { assert.equal((await selector.select(tracks, { limit: 2 }, settings, new Map())).source, "model"); });
});

test("Mandarin model hosting is contextual, catalogue-grounded and preserves original names; failure is Chinese too", async () => {
  const tracks:Track[]=[{id:"101",title:"测试歌名",artist:"测试歌手",source:"netease"},{id:"202",title:"Fixture Second",artist:"Fixture Artist",source:"netease"}];
  const chinese:RadioSettings={...settings,hostLanguage:"zh",voice:"zh-CN-XiaoxiaoNeural"};
  const plan={title:"给今晚一点留白",selections:[{id:"101",reason:"顺着当前听感继续",hosting:"先把忙碌放一放，让音乐接着陪你。下一首是测试歌手的《测试歌名》。"}]};
  await withSelector(plan,async selector=>{const result=await selector.select(tracks,{limit:2},chinese,new Map());assert.equal(result.source,"model");assert.equal(result.items[0]!.hosting,plan.selections[0]!.hosting);assert(isHosting(result.items[0]!.hosting,"zh"));});
  for(const text of ["English only hosting", "<speak>你好</speak>", "这位歌手出生于1974年。", "访问https://example.com继续播放"]){
    await withSelector({...plan,selections:[{...plan.selections[0],hosting:text}]},async selector=>{const result=await selector.select(tracks,{limit:2},chinese,new Map());assert.equal(result.source,"playlist");assert(result.items.every(item=>isHosting(item.hosting,"zh")));assert.equal(result.items[0]!.track.title,"测试歌名");});
  }
});

test("natural hosting keeps exact catalogue ID and uniqueness boundaries", async () => {
  for (const ids of [[" 202", "101"], ["999999", "101"], ["202", "202"]]) {
    const plan = naturalPlan(); plan.selections.forEach((item, i) => { item.id = ids[i]!; });
    await withSelector(plan, async selector => {
      const result = await selector.select(catalogue, { limit: 2 }, settings, new Map());
      assert.equal(result.source, "playlist"); assert(result.warnings.length > 0);
      assert.deepEqual(result.items.map(item => item.track.id), ["101", "202"]);
    });
  }
});

test("natural hosting rejects markup, oversize prose and unsupported biography claims", async () => {
  for (const hosting of ["<script>not radio prose</script>", "A".repeat(900), "The artist was born in 1974 and recorded this album in a secret studio."]) {
    const plan = naturalPlan(); plan.selections[0]!.hosting = hosting;
    await withSelector(plan, async selector => {
      const result = await selector.select(catalogue, { limit: 2 }, settings, new Map());
      assert.equal(result.source, "playlist"); assert(result.warnings.length > 0);
      assert(!result.items.some(item => item.hosting.includes("1974") || item.hosting.includes("<script>")));
    });
  }
});
