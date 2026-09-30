import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../apps/server/dist/config.js';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contains = (parent, child) => { const p = relative(parent, child); return p === '' || (!p.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && p !== '..' && !isAbsolute(p)); };

/** Read-only and offline. Never open SQLite, start providers, or return config values. */
export async function deploymentPreflight(config, { envFile, repoDir = repository } = {}) {
  const checks = [];
  const check = (id, ok) => checks.push({ id, ok: Boolean(ok) });
  const [major, minor] = process.versions.node.split('.').map(Number);
  check('node_sqlite_runtime', major > 22 || (major === 22 && minor >= 13));
  check('https_public_origin', config.publicOrigin?.startsWith('https://'));
  check('loopback_listener', ['127.0.0.1', '::1'].includes(config.host) && config.port > 0);
  check('owner_password', Boolean(config.ownerPassword));
  check('credential_encryption_key', config.credentialKey?.length === 32);
  check('private_music_adapter_configured', Boolean(config.neteaseBase));
  check('application_model_configured', Boolean(config.modelBase && config.modelKey && config.modelName));
  check('english_tts_enabled', config.ttsEnabled);
  const root = await realpath(repoDir);
  const paths = {};
  for (const [id, path, directory] of [['private_environment', envFile, false], ['private_data', config.dataDir, true]]) {
    try {
      if (!path || !isAbsolute(path)) throw new Error();
      const stat = await lstat(path);
      const canonical = await realpath(path);
      check(`${id}_real_path`, !stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()));
      check(`${id}_outside_source`, !contains(root, canonical));
      // Windows mode bits cannot prove ACL isolation; block until a dedicated ACL review.
      check(`${id}_owner_permissions`, process.platform !== 'win32' && stat.uid === process.geteuid() && (stat.mode & 0o077) === 0 && (stat.mode & (directory ? 0o700 : 0o600)) === (directory ? 0o700 : 0o600));
      paths[id] = canonical;
    } catch {
      check(`${id}_real_path`, false);
    }
  }
  // Restored state must be private before startup opens it. Never read its contents.
  for (const [name, directory] of [['emily.sqlite', false], ['audio', true]]) {
    try {
      const stat = await lstat(join(config.dataDir, name));
      check(`existing_${name === 'audio' ? 'audio' : 'database'}_private`, !stat.isSymbolicLink() &&
        (directory ? stat.isDirectory() : stat.isFile()) && process.platform !== 'win32' &&
        stat.uid === process.geteuid() && (stat.mode & 0o077) === 0);
    } catch (error) {
      check(`existing_${name === 'audio' ? 'audio' : 'database'}_private`, error.code === 'ENOENT');
    }
  }
  try {
    if (!config.webDir) throw new Error();
    const web = await realpath(config.webDir);
    check('private_paths_outside_web', Boolean(paths.private_data && paths.private_environment) &&
      !contains(web, paths.private_data) && !contains(paths.private_data, web) && !contains(web, paths.private_environment));
    for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icons/emily-192.png', 'icons/emily-512.png', 'icons/emily-maskable-512.png']) {
      const path = join(web, file);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || !contains(web, await realpath(path))) throw new Error();
    }
    check('frontend_public_shell', true);
  } catch { check('frontend_public_shell', false); }
  let executable = false;
  const names = isAbsolute(config.ttsCommand) ? [config.ttsCommand] : (process.env.PATH || '').split(delimiter).filter(Boolean).map(path => join(path, config.ttsCommand));
  for (const path of names) {
    try {
      if (!(await lstat(path)).isFile()) continue;
      await access(path, constants.X_OK);
      executable = true;
      break;
    } catch { /* No executable path or filesystem errors are printed. */ }
  }
  check('tts_executable_present', executable);
  return { ok: checks.every(item => item.ok), checks, limitations: ['Offline configuration check only; adapter unlock policy, provider calls, DNS/TLS, proxy rules and physical phone playback still require verification.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await deploymentPreflight(loadConfig(), { envFile: process.argv[2] });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error('Deployment preflight failed. Check the private environment and built application. No configuration values are displayed.');
    process.exitCode = 1;
  }
}
