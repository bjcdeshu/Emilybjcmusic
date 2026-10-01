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

The 27 automated tests are **explicitly test-only fixtures**, not real provider acceptance. They cover audio sequencing, pause/async-operation races, stale play promises, actual-property progress/seek, autoplay rejection, audio/TTS failure, empty queues, logout cleanup, API envelopes/401, URL boundaries, and static-only service-worker caching. `FakeAudio` is never imported by the application. The root `npm run test:browser` also inspects login/listen/library/history/settings/QR and empty archive at360/393/768/1360px, shared control typography and44px primary controls, using explicitly browser-only collection/cover fixtures. It now exercises actual Chrome decoding, DJ/song/next sequencing, pause/seek/quiet mode, feedback/history/voice selection/logout and static-only offline PWA against explicit local HTTP/tone-MP3 fixtures. Real account audio, human listening and physical Xiaomi background playback remain unverified.

## Listening conversation (Pi / 2026-10-01)

Player's “聊聊想听什么” and Programme's “和 Emily 聊聊” open the shared station dialog. Written dialogue supports Chinese/preferences/named tracks and refinement, then displays only the server's actual rights-checked candidates. Explicit “播放这档节目” uses the existing programme/audio flow; consultation itself never interrupts playback. Dialogue lives only in page memory (bounded30 turns/latest11 sent), survives dialog close/navigation, clears on logout/disconnect/reload, and is never cached/persisted. Context/catalogue metadata are sent to the existing configured model; English hosting remains separate. Failure stays visible and does not silently switch tracks. Browser covers two-turn refinement, reopen, explicit acceptance and clear; server contracts cover IDs/rights/auth/limits/failure.

## Playlist roaming (Pi / 2026-10-01)

New owner-playlist programmes default to the opt-out original-playlist roaming checkbox; explicit picked tracks do not enable it. Player toggles only this scope, without changing audio. Near the last3 items server refills up to12 per batch; the existing real ended flow advances. Authenticated polling every10 seconds merges roaming/queue only and rejects stale action/scope/timestamp results, never overwrites transport. Disabling immediately hides the preparing label even while invalidated work drains. Same-run ID deduplication, bounded queue and honest source exhaustion/failure are server-owned; it is not cross-source discovery or unlimited background assurance. Conversation sends previous direction/IDs (server rehydrates trusted metadata), displays direction and confirms ordered tracks without a second model reorder. Browser fixture crosses12→13 using seek+actual ended and verifies toggle does not resume paused audio; real provider evidence/boundaries live in docs/development.md.

## Implementation boundaries

- A single mounted `<audio>` plays a prepared `tts_ready` DJ segment, then the song. Only media events/properties determine the local transport state and progress. Server `playing` flags never cause restore/autoplay.
- Queue advancement starts from a real `ended` event. Pause remains authoritative during asynchronous resolution. Quiet mode skips speech without resuming a paused player.
- Media Session metadata, transport handlers and position state follow this local audio element, not an invented server timeline.
- `audio-analysis.ts` owns one Web Audio graph for the mounted audio element. `RadioSignal.tsx` renders actual frequency samples as reference-style bars; missing analysis is flat, never a simulated waveform. Canvas RAF stops when hidden/offscreen/paused and reduced motion is static. Transport continues to belong to the existing audio engine. No vinyl/cover stage remains. Transcript text is the actual API text; no fabricated word timing/highlighting. `HostWordmark.tsx` is original dot-matrix station lettering, not a copied avatar/font. `styles.css` now owns the whole-product tokens (font/colours/radii/control sizes/motion), navigation, login, collection, archive, preferences and dialogs. `radio-design.css` only owns the listening layout and consumes those tokens, with no competing global font/shell overrides. Shared `StationIdentity`/`PageHeading` extend the reference consistently across screens. Design rationale is in `docs/ui-design.md`.
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
