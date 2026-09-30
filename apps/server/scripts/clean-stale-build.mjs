// Only remove artifacts from the retired production mock, never another workspace's build.
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
for (const name of ['mockState.js', 'mockState.js.map', 'mockState.d.ts']) {
  await rm(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)), { force: true });
}
