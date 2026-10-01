import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calmWaveform,waveformLevels} from '../src/signal-waveform.ts';
import {lyricIndex} from '../src/lyric-position.ts';

test('waveform windows follow real amplitude without left/bass duplication, DC silence flat and missing analysis quiet',()=>{
  assert.deepEqual(waveformLevels(new Uint8Array(),60),[]);
  assert(waveformLevels(new Uint8Array(256).fill(128),70).every(x=>x===0));
  assert(waveformLevels(new Uint8Array(256).fill(0),70).every(x=>x===1));
  const input=new Uint8Array(8).fill(128);input.fill(192,4);
  assert.deepEqual(waveformLevels(input,4),[0,0,.5,.5]);
  const centered=new Uint8Array([128,128,0,255,0,255,128,128]);
  const values=waveformLevels(centered,4);assert.equal(values[0],0);assert.equal(values[3],0);assert.equal(values[1],values[2]);assert(values.every(x=>x>=0&&x<=1));
});
test('calm envelope averages real neighbours, limits per-frame changes and settles; silence resets immediately',()=>{
  const input=[0,0,1,0,0];let prior=calmWaveform(input,[],16);
  assert(prior.every(x=>x>=0&&x<.03),'no instantaneous jump to a peak');assert(prior[2]>prior[0]);
  for(let n=0;n<100;n++){const next=calmWaveform(input,prior,16);assert(next.every((x,i)=>Math.abs(x-prior[i])<.03));prior=next;}
  assert(prior[2]>.2&&prior[2]<.4);assert.deepEqual(calmWaveform([0,0,0,0,0],prior,16),[0,0,0,0,0]);
  assert.deepEqual(calmWaveform(input,prior,0),prior);
});
test('lyrics use exact current audio time; backward/forward seek, blank spans and untimed text never receive fabricated time',()=>{
  const lines=[{timeMs:1000,text:'TEST A'},{timeMs:2350,text:'TEST B'},{timeMs:5000,text:''}];
  assert.equal(lyricIndex(lines,0),-1);assert.equal(lyricIndex(lines,.999),-1);
  assert.equal(lyricIndex(lines,1),0);assert.equal(lyricIndex(lines,2.349),0);assert.equal(lyricIndex(lines,2.35),1);
  assert.equal(lyricIndex(lines,5),2);assert.equal(lyricIndex(lines,100),2);
  assert.equal(lyricIndex(lines,1.5),0);assert.equal(lyricIndex([],4),-1);
});
