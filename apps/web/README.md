# Emily web — integration handoff

Owner scope: `apps/web/**`. React/Vite, shared `ApiResponse<T>` contract, no new dependencies.

## Executable checks

From the repository root:

```sh
npm run test --workspace @emily/web
npm run typecheck --workspace @emily/web
npm run build --workspace @emily/web
npm run dev --workspace @emily/web
```

Development and preview bind `127.0.0.1`. Development `/api` proxies to the loopback server on port 3000. Tests use Node's test runner and TypeScript stripping; the verified local runtime was Node 26.7.0.

The 27 automated tests are **explicitly test-only fixtures**, not real provider acceptance. They cover audio sequencing, pause/async-operation races, stale play promises, actual-property progress/seek, autoplay rejection, audio/TTS failure, empty queues, logout cleanup, API envelopes/401, URL boundaries, and static-only service-worker caching. `FakeAudio` is never imported by the application. The root `npm run test:browser` now exercises actual Chrome decoding, DJ/song/next sequencing, pause/seek/quiet mode, feedback/history/voice selection/logout and static-only offline PWA against explicit local HTTP/tone-MP3 fixtures. Real account audio, human listening and physical Xiaomi background playback remain unverified.

## Implementation boundaries

- A single mounted `<audio>` plays a prepared `tts_ready` DJ segment, then the song. Only media events/properties determine the local transport state and progress. Server `playing` flags never cause restore/autoplay.
- Queue advancement starts from a real `ended` event. Pause remains authoritative during asynchronous resolution. Quiet mode skips speech without resuming a paused player.
- Media Session metadata, transport handlers and position state follow this local audio element, not an invented server timeline.
- `RadioSignal.tsx` draws phase-dependent decorative curves, **not an audio-derived waveform**. Canvas RAF stops when hidden/offscreen, after pause settles, or for reduced motion. CSS vinyl rotation follows actual music-playing and stops on pause; reduced motion disables it. Transcript text is the actual API text; no fabricated word timing/highlighting. `radio-design.css` owns the second-round artwork-led layout/motion; imported after base styles.
- Catalogue/search/playlist/history/feedback data come only from the contract endpoints. A like is shown only after `saved: true`; skipping is not dislike feedback.
- Login, owner-scoped QR polling and settings use same-origin HttpOnly-cookie API sessions. No password, provider cookie, key, private catalogue or audio is written to browser storage/cache.
- Production registers `public/sw.js`. It caches only the static index, explicitly listed PWA files, and hashed JS/CSS. Static fetches omit credentials. API, QR, covers and media are not intercepted or cached. Development does not install the worker.
- Artwork is optional and has a text fallback. The original reference image remains untouched. Emily's emblem/icons are original; `python apps/web/scripts/generate_icons.py` regenerates the PNGs without dependencies.

## Parent integration checks

1. Exercise every protected API against the server implementation and validate meaningful errors; no frontend contract extension is required.
2. Validate `voice` against the backend's allowlist. The settings select uses the shared allowlist; choices are supported IDs, not a claim that online voice availability has been verified at that moment.
3. Serve the production build at the origin root over HTTPS (or localhost), serve `sw.js` as JavaScript, and keep `/api/**` out of SPA rewrites and HTTP caches. Increment the shell cache version when changing its release policy.
4. Supply HTTPS-compatible or same-origin-proxied audio URLs. Mixed-content, credential-bearing and non-HTTP URLs are rejected rather than played.
5. David's 2026-09-30 correction cancels physical Xiaomi/lockscreen/PWA acceptance as delivery gates. Focus on mmguo-inspired visual quality and normal browser interaction regressions; do not ask the owner for a device-test checklist or falsely mark untested device behaviour as passed.

No commits, external publishing, DNS/service changes, root manifest/lockfile writes, backend writes or credential discovery were performed by this worker.
