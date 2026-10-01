# Emily whole-product visual system

2026-10-01 / Pi. David rejected the inconsistency of 4c70e9f. On e4e1b01 he liked the audio bars and improved atmosphere, but requested better lower-region integration. This is partial positive feedback, not whole-product approval.

## Direction

A private radio desk, extending mmguo's dark dot-matrix identity across the whole product. Earlier releases used an overlapping white programme; David's latest 2026-10-01 correction explicitly requests the listening controls and motion to feel like ONE continuous space. The player now has a continuous graphite surface; collection/archive/preferences/dialog retain reading paper. No vinyl metaphor, marketing landing page, unrelated pastel moods or admin-dashboard sections. Catalogue artwork is genuine content, not wallpaper. Dot-matrix station lettering is the signature; speech and tracks still use actual APIs/audio.

- World: a personal programme, its collection, archive and listening preferences.
- Surfaces: continuous graphite listening stage/control/transcript surface; soft cool-white reading paper for collection/archive/preferences/dialog, soft-grey inset fields there, thin neutral rules. Light extends through the player rather than stopping at a rounded white-card edge.
- Palette: night `#090c13`, stage `#121417`, paper `#f5f7f5`, inset `#ecf0ed`, ink `#202525`, secondary `#68716f`, mint `#85ddbc`; red only for destructive/error actions.
- Typography: one system sans stack across ALL screens, including player/login/dialog; original SVG dot lettering for station identity; monospace ONLY for labels/time. No italic e or per-page font overrides.
- Scale: body14/line1.65, captions12, section18, page/programme32 desktop/28 mobile. 4px spacing rhythm, 24px desktop/20px mobile surface padding; outer28/inset16/control12 radii.
- Motion: 240ms shared ease for controls, 400ms surface/content entry; David's later 2026-10-01 request adds one coherent sound-spreading ambient treatment, not a new visual theme. Slow surrounding/stage light drifts only while real local audio plays and the signal is visible. Actual analyser energy/bass modulate stage light, paper seam, on-air halo, play-button rim and speaking-dot radius; not beat/BPM detection. Pause/hidden/offscreen/reduced-motion reset energy and stop ambient loops. Reduced motion/static, stable widths, no animated text reflow.

## Shared shell

```
station name              Listen / Programme / Archive / Preferences
┌─ graphite dot stage ────────────────────────────────────────────┐
│ station identity / section                                      │
│ page title and one useful sentence                              │
├─ overlapping white paper ───────────────────────────────────────┤
│ content / grouped controls / one clear primary action            │
└─────────────────────────────────────────────────────────────────┘
               persistent mini transport on non-listen views
```

All authenticated screens share the same 680px desktop surface/grid edge; mobile16px outer inset. Navigation uses the same station-mint selection state desktop/mobile. Mini transport shares white paper/ink/mint selection and remains above the mobile nav; content bottom padding accounts for BOTH. Toast appears above transport, never covers top identity. Login is the same surface at480px, not a marketing split-screen. QR dialog has the same stage heading, paper content and controls.

## Screens

- Listen: retain the positively reviewed reference stage and actual analysis. One continuous dark reading surface: programme/track, transport, transcript, quiet secondary controls, queue. Scope night tokens to radio-device (light text/muted mint controls/subtle rules) rather than changing global styles or darkening unrelated screens. Remove second-card background/radius/overlap/shadow; actual-sample diffuse light flows from stage to lower controls and transcript. Align transcript with programme text; no large nested transcript card or artificial speaking-state fill. Speaking is indicated by the real-state dot/label, not simulated word timing. Reduce excess fixed whitespace and preserve44px controls. DOM follows reading order, with no CSS order overrides.
- Programme: clear three-step flow within one paper: listening direction, genuine playlist, optional search. Mood presets are neutral segmented cards; mint denotes selection, not unrelated categories. Primary launch reflects selected music. Real covers remain collection-first.
- Archive: date/track count are small metadata; programme title and real tracks form consistent rows, no ornamental History badges. Revisit action is the same secondary button as elsewhere.
- Preferences: listening/voice first, account & service status second, install/help collapsed by default; technical voice IDs replaced with human labels. Connection/disconnection/logout boundaries unchanged.
- Login: station identity + private-access caption, concise Chinese entry, same input/action styles. No giant emblem or promotional headline.
- QR: same section heading, status frame, explanatory copy and standard primary/secondary actions. Preserve original secure dialog and owner-scoped polling.

## Listening dialogue (David request / 2026-10-01)

The original reference's conversation intent returns as an owner-only listening consultation. Entry inside programme heading and collection page; same graphite identity and cool-white paper modal, calm written turns, verified-track proposal and one explicit play action. Do not turn this into a general agent console or a floating third-party widget. Chinese conversation is distinct from English spoken hosting. Suggestions do not interrupt audio; close/reopen preserves volatile context, logout clears it.

## Immersive listening (David request / 2026-10-01)

Retain the positively reviewed bars, original dot identity and uninterrupted reading paper. Add low-contrast mint/blue light around the desk and beneath the signal, spreading the same real audio energy into small indicators/edges. Reuse the signal's existing RAF/analyser buffer to set CSS variables, without React state per frame, another audio graph or synthetic waveform. Decorative slow drift is a playing-state atmosphere, not an audio metric; actual intensity remains actual samples, zero when silent/unavailable. Text remains stationary while reading; existing programme/track/transcript content enters only when content changes.

The existing immersion button now hides shell navigation/footer, widens the listening desk to820px desktop, enlarges the signal stage responsively, and retains pause/seek/next/previous/chat/exit. Enter/exit never remounts audio or changes transport. Exit button and Escape (unless a dialog owns it) restore ordinary navigation. This is a page layout, NOT an OS/browser fullscreen promise; no permanent setting/cache and no new service. Small widths must not overflow from moving background layers. Mobile remains scrollable for long real transcripts/warnings, rather than clipping to a fixed-height fake full-screen mockup.

## Continuous playback surface (David correction / 2026-10-01)

David likes the upper motion, but finds the lower playback card insufficiently immersive and wants the two integrated. Preserve the upper bars/stage treatment rather than redesigning them. Use one stage background and an aria-hidden whole-device light layer, reusing the existing energy/bass CSS variables and playing/visibility gate. The lower area is transparent with zero second-card radius and no independent edge/shadow; its diffuse response extends the upper light. Keep reading text still, indicators honest, layout/focus order and44px controls unchanged. Waveform bottom has a small alpha feather so silence's flat baseline does not become a new dividing rule; frequency heights still come from actual samples. Reduced motion suppresses new light layers; pause stops ongoing drift. The page-level immersive mode and ordinary listen both use this continuity, not only a special screenshot variant. Other screens remain their established graphite+paper system.

## Mobile first-screen UX (David correction / 2026-10-01)

Mobile entry must make listening available without hunting below the fold, not simply shrink every font. Hide the redundant listen header/footer only on mobile; retain ordinary navigation. Reserve a viewport-relative stage for the positively reviewed actual spectrum, then actual track title/artist and progress/transport. Remove repeated host/elapsed labels and large programme title. Programme context/source/full original names, volume, less-like and roaming settings belong to a labelled disclosure; queue preview exposes actual next title/count. Hosting is a native details disclosure with a short real preview during DJ phase, full text on request, no invented word timing. Likes/quiet/consultation remain immediate. Errors requiring action, media warnings, offline/account/setup issues stay visible. Warnings explaining successful selection remain readable with programme details rather than duplicated banners above playback.

Do not lock the document to a fake fixed-height viewport or clip expanded content. Small-screen stage/spacing adapt to dvh; at360x560 and393x640/740/851 actual track, progress, transport, main tools and disclosure entries must fit above normal navigation, including long-title/long-hosting stress. Expanded details may scroll intentionally; opening them never changes audio. Existing listening night tokens/sound gate/shared reading-paper screens remain unchanged. A narrow server-only restart-hint lifecycle repair is allowed in this iteration, not general backend/transport redesign. Test fixtures and Pi screenshot review are not David acceptance.

## Review and boundaries

Use explicit local test catalogue with sufficient covers/history to inspect actual density, plus empty/error/modal states. Capture login/listen/programme/archive/preferences/dialog at393px and desktop, and check360/768px widths and 44px controls. Side-by-side contact sheet is a review aid, not a production fixture route. Keep private screenshots outside Git. Do not modify schema/TTS/playback engine or add services for this design task; the mobile iteration's explicit narrow restart-hint repair is documented above. Publish only after whole-screen review and existing relevant browser regression; technical success never means David accepted aesthetics.
