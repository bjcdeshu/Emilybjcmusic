import {test} from 'node:test';import assert from 'node:assert/strict';
import {frequencyGroups,quietRhythm,rhythmFrame} from '../src/signal-rhythm.ts';
test('frequency groups cover each measured bin once, no left-bin duplication, mirror or invented peaks',()=>{
 const data=new Uint8Array(1024);data[4]=255;
 const groups=frequencyGroups(data,48000);assert.equal(groups.length,24);assert.equal(groups.filter(x=>x>0).length,1);
 assert.deepEqual(frequencyGroups(new Uint8Array(1024),48000),Array(24).fill(0));
 assert.deepEqual(frequencyGroups(data,0),[]);assert.deepEqual(frequencyGroups(new Uint8Array(),48000),[]);
 for(const n of [8,16,24]){const flat=frequencyGroups(new Uint8Array(1024).fill(128),44100,n);assert.equal(flat.length,n);assert(flat.every(x=>Math.abs(x-128/255)<1e-6));}
});
test('accent responds to actual low-energy rise, steady tone settles, gates zero immediately and frames are time-based',()=>{
 const base=Array(24).fill(.15),peak=base.map((x,i)=>i<5?.65:x);
 let state=quietRhythm();for(let i=0;i<120;i++)state=rhythmFrame(base,state,16,true);
 assert(state.accent<.001);const hit=rhythmFrame(peak,state,16,true);assert(hit.accent>.3&&hit.accent<=.65);
 assert(hit.body-state.body<.01,'room does not flash with the accent');assert(hit.levels[0]-state.levels[0]<.1);
 let held=hit;for(let i=0;i<300;i++)held=rhythmFrame(peak,held,16,true);assert(held.accent<.002,'steady sustained bass does not oscillate');
 const off=rhythmFrame(peak,hit,16,false);assert.equal(off.body,0);assert.equal(off.accent,0);assert(off.levels.every(x=>x===0));
 let fast=quietRhythm(),slow=quietRhythm();for(let i=0;i<100;i++)fast=rhythmFrame(base,fast,10,true);for(let i=0;i<50;i++)slow=rhythmFrame(base,slow,20,true);assert(Math.abs(fast.body-slow.body)<1e-8);assert(Math.abs(fast.levels[0]-slow.levels[0])<1e-8);
 assert(rhythmFrame(base,quietRhythm(),10000,true).body<.03,'return from hidden cannot jump the envelope');
});
test('foreground detail is three distinct measured ranges, stable tone stays stable and quiet resets all',()=>{
 for(const band of [0,1,2]){
  const groups=Array.from({length:24},(_,i)=>Math.floor(i/8)===band?.5:0);let state=quietRhythm();
  for(let i=0;i<200;i++)state=rhythmFrame(groups,state,16,true);
  assert(state.detail[band]>.499);assert(state.detail.every((v,i)=>i===band||v===0));
  assert.deepEqual(rhythmFrame(groups,state,16,false).detail,[0,0,0]);
  assert.deepEqual(rhythmFrame([],state,16,true).detail,[0,0,0]);
 }
});
