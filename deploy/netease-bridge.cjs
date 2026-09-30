// Private bridge for the audited upstream commit. Not the upstream public server.
// Only Emily's fixed POST routes; no cache, public files, proxy, unblock or raw logs.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const upstream = process.env.EMILY_ADAPTER_UPSTREAM;
const token = process.env.EMILY_ADAPTER_TOKEN;
if (!upstream || !token || token.length < 32 || process.env.ENABLE_GENERAL_UNBLOCK !== 'false' || process.env.ENABLE_PROXY !== 'false') {
  process.stderr.write('Private adapter configuration failed.\n'); process.exit(1);
}
// Upstream modules can otherwise log full bodies on errors. Suppress before loading.
for (const name of ['log', 'error', 'warn', 'info', 'debug']) console[name] = () => {};
process.env.NETEASE_COOKIE = '';
process.env.ENABLE_RANDOM_CN_IP = 'false';
fs.mkdirSync(os.tmpdir(), { recursive: true, mode: 0o700 });
const anonymous = path.join(os.tmpdir(), 'anonymous_token');
if (!fs.existsSync(anonymous)) fs.writeFileSync(anonymous, '', { mode: 0o600 });
const { cookieToJson, generateRandomChineseIP } = require(path.join(upstream, 'util/index.js'));
global.cnIp = generateRandomChineseIP();
const axios = require(require.resolve('axios', { paths:[upstream] })).default;
axios.defaults.timeout = 20000;
const upstreamRequest = require(path.join(upstream, 'util/request.js'));
// Use the established eapi transport for xeapi modules: RN's new security-key
// registration timed out. This still requests original NetEase endpoints with
// the owner's authorization, never an unlock, region spoof or alternate source.
const request = (uri, data, options) => upstreamRequest(uri, data, {
  ...options, crypto:options.crypto === 'xeapi' ? 'eapi' : options.crypto
});
const routes = new Map([
  ['login/status', 'login_status'], ['login/qr/key', 'login_qr_key'],
  ['login/qr/create', 'login_qr_create'], ['login/qr/check', 'login_qr_check'],
  ['user/playlist', 'user_playlist'], ['playlist/track/all', 'playlist_track_all'],
  ['cloudsearch', 'cloudsearch'], ['song/detail', 'song_detail'], ['song/url/v1', 'song_url_v1']
].map(([route, name]) => ['/' + route, require(path.join(upstream, 'module', name + '.js'))]));
const allowed = new Set(['cookie','noCookie','timestamp','key','qrimg','uid','id','ids','limit','offset','keywords','type','level','unblock']);
const expectedAuth = Buffer.from('Bearer ' + token);
let active = 0;
function send(res, code, body) { res.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'private, no-store' }); res.end(JSON.stringify(body)); }
const server = http.createServer(async (req, res) => {
  const auth = Buffer.from(req.headers.authorization || '');
  if (auth.length !== expectedAuth.length || !crypto.timingSafeEqual(auth, expectedAuth)) return send(res, 401, { code:401 });
  if (req.url === '/health' && req.method === 'GET') return send(res, 200, { code:200, adapter:'emily-private', unlocking:false });
  const fn = routes.get(req.url);
  if (req.method !== 'POST' || !fn) return send(res, 404, { code:404 });
  if (active >= 4) return send(res, 429, { code:429 });
  active++;
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16384) { send(res, 413, { code:413 }); req.destroy(); return; } chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) return send(res, 400, { code:400 });
    if (input.cookie !== undefined && typeof input.cookie !== 'string') return send(res, 400, { code:400 });
    const result = await fn({ ...input, cookie:input.cookie ? cookieToJson(input.cookie) : {},
      unblock:'false', level:'standard', noCookie:true, timeout:20000, randomCNIP:false }, request);
    const body = JSON.stringify(result.body);
    if (body.length > 4_000_000) return send(res, 502, { code:502 });
    send(res, 200, result.body); // Never forward upstream Set-Cookie or redirects.
  } catch { send(res, 502, { code:502, message:'Private music adapter request failed.' }); }
  finally { active--; }
});
server.requestTimeout = 25000;
server.headersTimeout = 10000;
server.on('clientError', (_error, socket) => socket.destroy());
server.listen(3101, '127.0.0.1', () => process.stdout.write('Emily private music adapter listening on loopback; xeapi modules use eapi transport.\n'));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
