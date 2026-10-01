# Emily — executable personal radio backend

This module replaces the production Phase 2 mock. No catalogue, account, audio URL or progress timer is fabricated at runtime. Only the tests contain explicitly labelled fixtures. No new npm dependencies were added; SQLite uses `node:sqlite` (Node 22.13+; verified here on Node 26.7.0). Import `buildApp` / `createApp` from `src/app.ts` or `dist/index.js` for Fastify injection; importing does not listen. The command entrypoint defaults to `127.0.0.1:3000`.

This is active development, not completed product acceptance. Pi's Windows continuation fixes the two handoff regressions: one-track DJ lookahead is bounded/deduplicated, and pause wins over pending play/next preparation while other preparation remains exclusive. Tests also cover clear, voice-change and shutdown boundaries. Current execution/verification state is in `docs/development.md`; `docs/handoff-to-pi-20260930.md` preserves Iris's historical snapshot. The Node command entrypoint does not automatically load a root `.env`; from the repository root, a configured built app can be started with `node --env-file=.env apps/server/dist/index.js`. Do not mistake this handoff for a live NetEase/model connection or public deployment.

## Run and verify from the repository root

```sh
npm run typecheck --workspace @emily/server
npm run typecheck:tests --workspace @emily/server
npm run build --workspace @emily/server
npm test --workspace @emily/server
npm run test:tts --workspace @emily/server
npm run test:built --workspace @emily/server
npm run start --workspace @emily/server
```

The last command is a running service, not part of automated tests. Test servers bind `127.0.0.1` on ephemeral ports and tests use temporary directories under explicit `TMPDIR` or the platform's `os.tmpdir()`. The real Edge check synthesizes a sentence in the selected hosting language (default Mandarin), validates female voice metadata, uses ffprobe/ffmpeg to decode the MP3, checks a cache hit, and removes its temporary media. Ordinary tests exercise local HTTP NetEase/model fixtures and CLI/audio fixtures; they do **not** prove a real NetEase account or real model is connected.

## Application environment (parent/operator provisions secrets)

| Name | Use |
| --- | --- |
| `EMILY_OWNER_PASSWORD` | Required for owner access; 12–1024 characters. No registration endpoint. Missing value fails closed. |
| `EMILY_PUBLIC_ORIGIN` | Exact browser origin, e.g. the independent HTTPS radio origin. No paths, credentials, query, hash or wildcard. Set to the Vite origin in proxied local development. |
| `EMILY_DATA_DIR` | Private persistent directory. Defaults to `apps/server/data`; directory 0700, SQLite 0600 on POSIX. Windows mode bits are **not** ACL protection: before real credentials, provision an owner-only Windows directory and verify its ACL; do not use the broadly inherited work directory for private data. Never serve or commit it. |
| `EMILY_SESSION_TTL_SECONDS` | Default 43200 (12 hours); bounded 300–604800. At most five active hashed sessions; logout invalidates the session. Password changes invalidate old sessions. |
| `EMILY_NETEASE_API_BASE` | A private, operator-controlled NetEaseCloudMusicApiEnhanced-compatible HTTP API. HTTPS required except literal loopback/localhost HTTP. No redirects or client-supplied base/URL. |
| `EMILY_NETEASE_API_TOKEN` | Optional Bearer token for a private adapter gateway. |
| `EMILY_CREDENTIAL_KEY` | 64 hexadecimal characters (32 random bytes), required for QR credential persistence. AES-256-GCM key; retain securely for restarts and backups. Never print or commit it. |
| `EMILY_NETEASE_COOKIE` | Optional alternative: the owner's own authorized cookie provided through application env. Never written to plaintext state. An explicit disconnect disables this binding until QR reconnection. |
| `EMILY_MODEL_BASE_URL` | OpenAI-compatible base **including** `/v1` when the gateway requires it. HTTPS or loopback HTTP only. |
| `EMILY_MODEL_API_KEY`, `EMILY_MODEL_NAME` | Both required with the base for model selection. Model failure uses real playlist selection with an explicit warning. |
| `EMILY_HTTP_TIMEOUT_MS` | Default 12000; includes JSON response-body reading; redirects rejected; JSON bounded to 4 MB. |
| `EMILY_TTS_ENABLED` | `true` (default) or `false`. Failure/disabled state yields chosen-language text, not fictitious audio. |
| `EMILY_TTS_COMMAND` | `uvx` (default), `edge-tts`, or their absolute executable path (Windows `uvx.exe` / `edge-tts.exe` paths supported; no cmd/bat/shell). uvx uses fixed args `--from edge-tts edge-tts`. |
| `EMILY_TTS_VOICE` | Default `zh-CN-XiaoxiaoNeural`. Allowlist is exported in `src/config.ts`: Mandarin Xiaoxiao/Xiaoyi plus the seven prior English female voices. Settings can change within that allowlist. |
| `EMILY_TTS_TIMEOUT_MS` | Default 25000; bounded 100–120000. Cached synthesis uses argument arrays, no shell, modest rate/volume, and does not inherit application credentials. |
| `EMILY_WEB_DIST_DIR` | Optional built frontend directory. Serves only index, public asset/font/icon/manifest/service-worker paths. Denies dotfiles, maps, source/private files and escaping symlinks. |
| `EMILY_HOST`, `EMILY_PORT` | Default loopback and 3000. Parent owns reverse proxy, TLS and deployment. |

HTTPS public origins use a `__Host-` HttpOnly, Secure, SameSite=Strict cookie. No wildcard CORS or forwarded host/IP trust is enabled. Browser mutations require an exact allowed Origin (or same-origin Fetch Metadata when Origin is absent); non-browser clients should explicitly send the configured Origin. Login has durable per-IP/global attempt bounds. `/api/health` and `/api/session` expose only minimal safe status; settings, music, radio, history and media require owner auth.

## Adapter and programme behaviour

Fixed POST endpoints: `login/status`, `login/qr/key`, `login/qr/create`, `login/qr/check`, `user/playlist`, `playlist/track/all`, `cloudsearch`, `song/detail`, `song/url/v1`, `lyric`. Lyrics are retrieved only through the fixed private route for known real catalogue IDs, bounded parsed LRC/untimed/no-lyrics states; no public lyrics, alternate source or persistence. Cookies go in JSON bodies, never URL query strings. Raw provider JSON/errors, keys, cookies, TTS stderr and request objects are not logged/returned. QR sessions use random application tickets tied to the owner session, three-minute expiry and bounded polling/creation. Connection is verified before use and rechecked periodically; persisted cookies are encrypted with the application key.

**The parent must provision an authorized adapter with `ENABLE_GENERAL_UNBLOCK=false` and no unlocking/matching/proxy plugins.** This application always sends `unblock: "false"` and `level: "standard"`; it never calls `/song/url/match`. The upstream adapter's global unlock setting is outside this module's control. Preview-only, null/unsafe URL, entitlement and region failures are excluded/reported, never replaced with another music source. Only validated `*.music.126.net` URLs are accepted and legacy provider HTTP URLs are upgraded to HTTPS. Real authorized playback and actual provider CDN reachability still require the owner's account and parent integration.

A programme uses at most 100 real candidates and 1–12 selected tracks (default six); playlist selection uses the first 100 tracks of an own/subscribed playlist. Discovery optionally searches the connected account's catalogue for the supplied prompt. Feedback affects selection; navigation never writes permanent dislike feedback. Programme state, settings, history and feedback persist in SQLite. A prepared programme returns `paused`, not an autoplay assertion. Play sets the requested transport state, next/previous preserves a user pause, including pauses arriving during preparation, next stops at the end rather than pretending there are new tracks, and server responses do not simulate audio progress. Browser HTMLAudio events own actual progress/playback.

The model sees bounded catalogue metadata/IDs and preferences, never cookies or provider keys. Its structured output is validated for exact, unique, playable IDs. Iris's handoff revision allows concise natural English programme titles, reasons and hosting text, rather than restricting the host to a fixed phrase menu. Length/markup checks, a prompt prohibiting unsupported artist/recording facts, and a bounded check for common unsupported biography/year claims supplement catalogue validation; they are not a complete factual-verification system. Metadata is supplied by the music provider, not invented by the model. Old enum-style configured planners remain compatible. Invalid output or unavailable model calls trigger an honest real-playlist fallback. See `test/model-hosting.test.ts` and the dated handoff for the actual validation boundary.

David's 2026-10-01 request makes Mandarin Xiaoxiao the default. `isHosting()` requires Han characters in Chinese, rejects markup/controls/URLs, and uses the previous script boundary for optional English. Model hosting is natural Mandarin with original catalogue names, honest no-model fallback is Chinese too. One-time upgrade migrates old settings while preserving quiet/volume/mood/discovery and drops old DJ references; explicitly selecting English later persists. This is a bounded script check, not complete language identification or factual validation.

Optional English hosting retains the separate English/script boundary (`hosting-language.ts`): non-Latin letters, markup and controls are rejected before model hosting acceptance and again before TTS/CLI invocation. Latin-script accented names remain eligible; this is not full language detection. Mixed-script catalogue names are omitted as a whole, never partially extracted, transliterated or falsely translated. The model receives nullable `spokenTitle`/`spokenArtist` and uses natural English references when unavailable; UI catalogue metadata stays original. Real-playlist fallback intros follow the same rule. On restart, existing persisted mixed scripts are replaced by safe intros and their stale DJ segments invalidated without clearing queue, owner authorization or history.

DJ MP3 routes require auth and a 64-hex cache identifier, reject traversal/symlinks, and support GET/HEAD/single byte Range. Track media is exposed only through `/api/media/track/:id` for known real catalogue tracks; there is no arbitrary `url=` proxy. Local audio uses entry/handle identity checks in addition to POSIX `O_NOFOLLOW`, which Windows does not implement. Keep private directories protected against other local writers. The production stream opener checks provider hostnames and public DNS addresses, pins the resolved address for TLS, validates redirects, and forwards only audio headers and a validated single Range—not cookies or authorization. Test media transports are injected explicitly and never used by the command entrypoint.

## Source/attribution and remaining integration

The HTTP shape was checked against primary upstream module/server sources at `https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced` (`login_qr_*`, `login_status`, `song_url_v1`, `user_playlist`, `playlist_track_all`, `cloudsearch`, `song_detail`). Implementation is original; no upstream source was copied and no additional licence payload is required.

Parent integration must supply the application env, private adapter and owner QR authorization, reconcile root lockfile/dependency warnings, wire same-origin frontend requests, and verify real tracks/model, physical Xiaomi background playback, HTTPS and deployment. Shared wire types/docs/root files were not modified by this worker. The same-origin `/api/media/track/:id` route is an intentional backend extension using the existing `Track.audioUrl` field; no shared type change is required.
