import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signalEnergy } from '../src/signal-energy.ts';

test('visual energy is bounded actual sample intensity; silence/missing bins never invent motion', () => {
  assert.deepEqual(signalEnergy(new Uint8Array()), { energy:0, bass:0 });
  assert.deepEqual(signalEnergy(new Uint8Array(128)), { energy:0, bass:0 });
  assert.deepEqual(signalEnergy(new Uint8Array(128).fill(255)), { energy:1, bass:1 });
  const samples = new Uint8Array(128); samples.fill(255,0,16);
  assert.deepEqual(signalEnergy(samples), { energy:0.125, bass:1 });
  samples.fill(0,0,16); samples.fill(255,16);
  assert.deepEqual(signalEnergy(samples), { energy:0.875, bass:0 });
});
