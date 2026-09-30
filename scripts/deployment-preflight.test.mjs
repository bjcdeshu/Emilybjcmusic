import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deploymentPreflight } from './deployment-preflight.mjs';
import { loadConfig } from '../apps/server/dist/config.js';

async function fixture(fn) {
  const base = await mkdtemp(join(tmpdir(), 'emily-preflight-test-'));
  const repoDir = join(base, 'source');
  const data = join(base, 'private');
  const web = join(repoDir, 'apps/web/dist');
  const envFile = join(base, 'fixture.env');
  const command = join(base, 'edge-tts');
  try {
    await mkdir(web, { recursive: true });
    await mkdir(join(web, 'icons'));
    await mkdir(data, { mode: 0o700 });
    await writeFile(envFile, '# TEST ONLY — no secrets\n', { mode: 0o600 });
    await writeFile(command, '# TEST ONLY — never executed\n', { mode: 0o700 });
    for (const name of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icons/emily-192.png', 'icons/emily-512.png', 'icons/emily-maskable-512.png']) await writeFile(join(web, name), 'fixture');
    const config = loadConfig({
      EMILY_HOST: '127.0.0.1', EMILY_PORT: '3100', EMILY_PUBLIC_ORIGIN: 'https://fixture.example',
      EMILY_OWNER_PASSWORD: 'fixture-owner-password-only', EMILY_CREDENTIAL_KEY: 'a'.repeat(64),
      EMILY_NETEASE_API_BASE: 'http://127.0.0.1:3101', EMILY_MODEL_BASE_URL: 'https://fixture.example/v1',
      EMILY_MODEL_API_KEY: 'fixture-not-a-real-key', EMILY_MODEL_NAME: 'fixture-model',
      EMILY_TTS_COMMAND: command, EMILY_DATA_DIR: data, EMILY_WEB_DIST_DIR: web
    });
    await fn({ config, options: { envFile, repoDir }, data, web, envFile });
  } finally { await rm(base, { recursive: true, force: true }); }
}
const failed = result => result.checks.filter(item => !item.ok).map(item => item.id);

test('offline preflight accepts protected POSIX setup; Windows ACL remains explicitly unverified', () => fixture(async ({ config, options }) => {
  const result = await deploymentPreflight(config, options);
  assert.equal(result.ok, process.platform !== 'win32');
  assert.deepEqual(failed(result), process.platform === 'win32' ? ['private_environment_owner_permissions', 'private_data_owner_permissions'] : []);
  const output = JSON.stringify(result);
  for (const value of [config.ownerPassword, config.modelKey, config.credentialKey.toString('hex'), config.dataDir, options.envFile]) assert(!output.includes(value));
}));

test('missing credentials and public listener fail without creating SQLite or making provider calls', () => fixture(async ({ config, options, data }) => {
  const result = await deploymentPreflight({ ...config, host: '0.0.0.0', publicOrigin: 'http://127.0.0.1:3100', ownerPassword: undefined, credentialKey: undefined, modelKey: undefined, neteaseBase: undefined }, options);
  for (const id of ['loopback_listener', 'https_public_origin', 'owner_password', 'credential_encryption_key', 'application_model_configured', 'private_music_adapter_configured']) assert(failed(result).includes(id), id);
  const { readdir } = await import('node:fs/promises');
  assert.deepEqual(await readdir(data), []);
}));

test('source/private overlap and absent executable are rejected', () => fixture(async ({ config, options }) => {
  const result = await deploymentPreflight({ ...config, dataDir: options.repoDir, ttsCommand: join(options.repoDir, 'missing/edge-tts') }, options);
  assert(failed(result).includes('private_data_outside_source'));
  assert(failed(result).includes('private_paths_outside_web'));
  assert(failed(result).includes('tts_executable_present'));
}));

test('missing PWA icon and missing private environment fail closed', () => fixture(async ({ config, options, web, envFile }) => {
  await rm(join(web, 'icons/emily-192.png'));
  await rm(envFile);
  const result = await deploymentPreflight(config, options);
  assert(failed(result).includes('frontend_public_shell'));
  assert(failed(result).includes('private_environment_real_path'));
}));

test('restored database and audio directory must also be protected', () => fixture(async ({ config, options, data }) => {
  await writeFile(join(data, 'emily.sqlite'), 'TEST ONLY — not SQLite', { mode: 0o644 });
  await mkdir(join(data, 'audio'), { mode: 0o755 });
  const result = await deploymentPreflight(config, options);
  assert(failed(result).includes('existing_database_private'));
  assert(failed(result).includes('existing_audio_private'));
}));

test('broad POSIX permissions are not mistaken for privacy', () => fixture(async ({ config, options, data, envFile }) => {
  await chmod(data, 0o755);
  await chmod(envFile, 0o644);
  const result = await deploymentPreflight(config, options);
  assert(failed(result).includes('private_data_owner_permissions'));
  assert(failed(result).includes('private_environment_owner_permissions'));
}));
