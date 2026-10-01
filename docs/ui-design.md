# Emily whole-product visual system

2026-10-01 / Pi. David rejected the inconsistency of 4c70e9f; this is the implementation brief, not user design approval.

## Direction

A private radio desk, extending mmguo's dark dot-matrix stage and overlapping white programme across the whole product. No vinyl metaphor, marketing landing page, unrelated pastel moods or admin-dashboard sections. Catalogue artwork is genuine content, not wallpaper. Dot-matrix station lettering is the signature; speech and tracks still use actual APIs/audio.

- World: a personal programme, its collection, archive and listening preferences.
- Surfaces: graphite signal stage, clean white reading paper, soft-grey inset fields/transcript, thin neutral rules.
- Palette: night `#090c13`, stage `#121417`, paper `#ffffff`, inset `#f3f5f4`, ink `#202525`, secondary `#68716f`, mint `#85ddbc`; red only for destructive/error actions.
- Typography: one system sans stack across ALL screens, including player/login/dialog; original SVG dot lettering for station identity; monospace ONLY for labels/time. No italic e or per-page font overrides.
- Scale: body14/line1.65, captions12, section18, page/programme32 desktop/28 mobile. 4px spacing rhythm, 24px desktop/20px mobile surface padding; outer28/inset16/control12 radii.
- Motion: 240ms shared ease for controls, 400ms surface entry; no decorative looping except actual audio analysis. Reduced motion/static, stable widths, no animated text reflow.

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

- Listen: retain reference stage, actual analysis, programme title and transcript. Transport/progress remain real. Reading layout should not change between empty/populated states; 44px minimum touch targets.
- Programme: clear three-step flow within one paper: listening direction, genuine playlist, optional search. Mood presets are neutral segmented cards; mint denotes selection, not unrelated categories. Primary launch reflects selected music. Real covers remain collection-first.
- Archive: date/track count are small metadata; programme title and real tracks form consistent rows, no ornamental History badges. Revisit action is the same secondary button as elsewhere.
- Preferences: listening/voice first, account & service status second, install/help collapsed by default; technical voice IDs replaced with human labels. Connection/disconnection/logout boundaries unchanged.
- Login: station identity + private-access caption, concise Chinese entry, same input/action styles. No giant emblem or promotional headline.
- QR: same section heading, status frame, explanatory copy and standard primary/secondary actions. Preserve original secure dialog and owner-scoped polling.

## Review and boundaries

Use explicit local test catalogue with sufficient covers/history to inspect actual density, plus empty/error/modal states. Capture login/listen/programme/archive/preferences/dialog at393px and desktop, and check360/768px widths and 44px controls. Side-by-side contact sheet is a review aid, not a production fixture route. Keep private screenshots outside Git. Do not modify backend/schema/TTS/playback engine or add services for this design task. Publish only after whole-screen review and existing relevant browser regression; technical success never means David accepted aesthetics.
