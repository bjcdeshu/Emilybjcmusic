import { test } from "node:test";
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { EdgeTts, type TtsExecutor } from "../src/tts.js";
import { temporaryDirectory } from "./helpers.js";

// This executable is a CLI fixture, not a synthesizer. Real Edge is checked separately by test:tts.
const CLI_FIXTURE = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, 'calls.jsonl'), JSON.stringify({ args, appEnv: Object.keys(process.env).filter(k => k.startsWith('EMILY_')) }) + '\\n');
if (args.includes('--list-voices')) {
  process.stdout.write('Name Gender\\nzh-CN-XiaoxiaoNeural Female\\nzh-CN-XiaoyiNeural Female\\nzh-TW-HsiaoChenNeural Female\\nzh-TW-HsiaoYuNeural Female\\nen-US-EmmaMultilingualNeural Female\\nen-GB-SoniaNeural Female\\nen-US-GuyNeural Male\\n');
} else if (args[args.indexOf('--text') + 1] === 'TIMEOUT') {
  setTimeout(() => process.exit(0), 5000);
} else {
  fs.writeFileSync(args[args.indexOf('--write-media') + 1], Buffer.from('TEST_ONLY_SYNTHESIS_FIXTURE'.repeat(20)));
}
`;

// Windows cannot exec a Unix shebang. Run this explicit fixture via Node, never cmd/shell.
const fixtureExecutor: TtsExecutor = (command, args, options, callback) => {
  execFile(process.execPath, [command, ...args], options, callback);
};

test("Edge CLI uses argument arrays, allowlisted female metadata, cache and no application secrets in child env", async () => {
  const directory = await temporaryDirectory(); const command = join(directory, "edge-tts");
  await writeFile(command, CLI_FIXTURE); await chmod(command, 0o700);
  const tts = new EdgeTts(loadConfig({ EMILY_DATA_DIR: directory, EMILY_TTS_COMMAND: command }), Date.now, fixtureExecutor);
  try {
    assert.equal(await tts.available("en-US-EmmaMultilingualNeural"), true);
    assert.equal(await tts.available("en-US-GuyNeural"), false);
    const text = "Literal fixture text; $(touch SHOULD_NOT_EXIST) & more music.";
    const [first, same] = await Promise.all([tts.segment(text, "en-US-EmmaMultilingualNeural"), tts.segment(text, "en-US-EmmaMultilingualNeural")]);
    assert.equal(first.status, "tts_ready"); assert.equal(same.id, first.id);
    assert.equal((await tts.segment(text, "en-US-EmmaMultilingualNeural")).id, first.id);
    const calls = (await readFile(join(directory, "calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    for (const mixed of ["Here is 慢慢喜欢你.", "Next by 莫文蔚.", "Now: こんにちは."]) await assert.rejects(tts.segment(mixed, "en-US-EmmaMultilingualNeural"), (error: { code?: string }) => error.code === "INVALID_TTS_INPUT");
    assert.equal((await readFile(join(directory, "calls.jsonl"), "utf8")).trim().split("\n").length, 2, "mixed-language text is rejected before invoking the CLI");
    assert.equal(calls.length, 2, "one metadata probe and one synthesis, despite parallel/cache requests");
    assert.deepEqual(calls[1].args.slice(0, 4), ["--voice", "en-US-EmmaMultilingualNeural", "--rate=-4%", "--volume=-10%"]);
    assert.equal(calls[1].args[calls[1].args.indexOf("--text") + 1], text);
    assert.deepEqual(calls[1].appEnv, []);
    await assert.rejects(tts.segment("test", "--evil"), (error: { code?: string }) => error.code === "INVALID_TTS_INPUT");
    await assert.rejects(tts.segment("x".repeat(601), "en-US-EmmaMultilingualNeural"));
    await assert.rejects(readFile(join(directory, "SHOULD_NOT_EXIST")));
    assert.equal((await readFile(join(tts.audioDir, `${first.id}.mp3`))).length > 128, true);
    assert.equal(await tts.available("zh-CN-XiaoxiaoNeural"),true);
    const chinese=await tts.segment("下一首是测试歌手的《测试歌名》。", "zh-CN-XiaoxiaoNeural");
    assert.equal(chinese.language,"zh");assert.equal(chinese.status,"tts_ready");
    const chineseCalls=(await readFile(join(directory,"calls.jsonl"),"utf8")).trim().split("\n").map(line=>JSON.parse(line));
    assert.deepEqual(chineseCalls.at(-1).args.slice(0,5),["--voice","zh-CN-XiaoxiaoNeural","--rate=-2%","--volume=-12%","--pitch=-2Hz"]);
    assert.equal(await tts.available("zh-TW-HsiaoChenNeural"),true);
    await assert.rejects(tts.segment("English only", "zh-CN-XiaoxiaoNeural"));
    await assert.rejects(tts.segment("<speak>你好</speak>", "zh-CN-XiaoxiaoNeural"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Edge timeout fails honestly with text, never fake audio or escaped subprocess errors", async () => {
  const directory = await temporaryDirectory(); const command = join(directory, "edge-tts");
  await writeFile(command, CLI_FIXTURE); await chmod(command, 0o700);
  const tts = new EdgeTts(loadConfig({ EMILY_DATA_DIR: directory, EMILY_TTS_COMMAND: command, EMILY_TTS_TIMEOUT_MS: "1000" }), Date.now, fixtureExecutor);
  try {
    const segment = await tts.segment("TIMEOUT", "en-US-EmmaMultilingualNeural");
    assert.equal(segment.status, "tts_failed"); assert.equal(segment.audioUrl, undefined); assert.equal(segment.text, "TIMEOUT");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
