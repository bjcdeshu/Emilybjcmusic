import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Exercise the compiled command entrypoint with NO owner/provider credentials.
const dir = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'emily-built-smoke-'));
const env = {};
for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'SystemRoot', 'TMPDIR', 'TEMP', 'TMP']) if (process.env[key] !== undefined) env[key] = process.env[key];
Object.assign(env, { EMILY_DATA_DIR: dir, EMILY_HOST: '127.0.0.1', EMILY_PORT: '0', EMILY_TTS_ENABLED: 'false' });
const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
let text = '';
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
try {
  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Compiled server startup timeout')), 10000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Compiled startup exited ${code}: ${stderr}`)); });
    child.stdout.on('data', chunk => {
      text += chunk;
      const match = text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  const health = await fetch(`${address}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.status, 'ok');
  const session = await fetch(`${address}/api/session`);
  assert.deepEqual((await session.json()).data, { authenticated: false, configured: false });
  const now = await fetch(`${address}/api/now`);
  assert.equal(now.status, 503);
  assert.equal((await now.json()).error.code, 'OWNER_AUTH_UNCONFIGURED');
  const closed = once(child, 'exit');
  // Windows kill(SIGTERM) terminates, it does not deliver a graceful Unix signal.
  if (process.platform === 'win32') child.send({ type: 'shutdown' });
  else child.kill('SIGTERM');
  const [exitCode] = await closed;
  assert.equal(exitCode, 0);
  console.log(JSON.stringify({ compiledEntrypoint: true, loopbackEphemeral: true, healthStatus: 200, sessionConfigured: false, protectedNowStatus: 503, gracefulExit: 0 }));
} finally {
  if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'exit'); child.kill('SIGKILL'); await closed; }
  await rm(dir, { recursive: true, force: true });
}
