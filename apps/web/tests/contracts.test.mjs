import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_PROGRAMME_TRACKS } from "../../../packages/shared/src/index.ts";

test("new programmes and history replay share the server programme size limit", async () => {
  const source = await readFile(new URL("../src/views.tsx", import.meta.url), "utf8");
  assert.equal(MAX_PROGRAMME_TRACKS, 12);
  assert(source.includes("limit: MAX_PROGRAMME_TRACKS"));
  assert(source.includes("limit: Math.min(entry.tracks.length, MAX_PROGRAMME_TRACKS)"));
  assert(!source.includes("Math.min(entry.tracks.length, 20)"));
});
