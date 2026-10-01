import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLyrics } from "../src/lyrics.js";
import { COOKIE_SENTINEL, fixtureApp, headers, HttpFixture, login, temporaryDirectory, cleanup } from "./helpers.js";

// All lyrics here are explicit fixtures, not published/real catalogue lyrics.
test("LRC preserves real timestamps, fractions, multi-tags, blanks and positive offset; never creates a timeline for plain text", () => {
  const data=parseLyrics("101",{lrc:{lyric:"[ar:TEST]\n[offset:100]\n[00:02.3]Fixture B\n[00:00.00][00:01.010]Fixture A\n[00:02.40]\n[99:99.99]Invalid timestamp"}});
  assert.equal(data.status,"synced");
  assert.deepEqual(data.lines,[{timeMs:0,text:"Fixture A"},{timeMs:910,text:"Fixture A"},{timeMs:2200,text:"Fixture B"},{timeMs:2300,text:""}]);
  const plain=parseLyrics("101",{lrc:{lyric:"[ar:TEST]\nFixture untimed first\nFixture untimed second"}});
  assert.equal(plain.status,"plain");assert.deepEqual(plain.lines,[]);assert.equal(plain.text,"Fixture untimed first\nFixture untimed second");
  assert.equal(parseLyrics("101",{nolyric:true}).status,"instrumental");
  assert.equal(parseLyrics("101",{uncollected:true}).status,"missing");
  assert.equal(parseLyrics("101",{lrc:{lyric:""}}).status,"missing");
  assert.throws(()=>parseLyrics("101",{lrc:{lyric:"x".repeat(100001)}}));
});

test("lyrics API is owner/no-store/known catalogue only, real adapter route with bound failures and no transport/history writes", async () => {
  const directory=await temporaryDirectory(), provider=new HttpFixture();await provider.start();
  const app=fixtureApp(directory,{EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
  try {
    assert.equal((await app.inject({url:"/api/music/lyrics/101",headers:{origin:"https://radio.example"}})).statusCode,401);
    const cookie=await login(app);
    assert.equal((await app.inject({url:"/api/music/lyrics/101",headers:headers(cookie)})).statusCode,404);
    assert.equal((await app.inject({url:"/api/music/lyrics/invalid",headers:headers(cookie)})).statusCode,400);
    await app.services.music.search("fixture");
    const before=app.services.radio.now(),history=app.services.store.history();
    const response=await app.inject({url:"/api/music/lyrics/101",headers:headers(cookie)});
    assert.equal(response.statusCode,200,response.body);assert.equal(response.headers["cache-control"],"private, no-store");
    assert.equal(response.json().data.status,"synced");assert.equal(response.json().data.lines[1].timeMs,1000);
    assert(!response.body.includes(COOKIE_SENTINEL));assert.equal(response.headers["set-cookie"],undefined);
    const request=provider.requests.find(r=>r.path==="/lyric")!;assert.equal(request.body.cookie,COOKIE_SENTINEL);assert.equal(request.body.id,"101");
    provider.failPath="/lyric";
    const failed=await app.inject({url:"/api/music/lyrics/101",headers:headers(cookie)});assert.equal(failed.statusCode,502);assert(!failed.body.includes(COOKIE_SENTINEL));
    assert.deepEqual(app.services.radio.now(),before);assert.deepEqual(app.services.store.history(),history);
  } finally {await cleanup(app,directory);await provider.close();}
});
