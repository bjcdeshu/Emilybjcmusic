# Emily project continuation

## Entry and current responsibility

Read `README.md`, `docs/development.md`, `docs/handoff-to-pi-20260930.md`, and the relevant module README before editing. `docs/development.md` is the sole current execution-state entry; the dated handoff is a snapshot, not a competing RUN.

David's latest assignment is to let the computer-side Pi Agent continue this project. Iris has stopped feature development and is preserving/syncing the handoff. The two Hermes implementation workers have finished. A receiving agent must inspect its actual local checkout, branch, dirty files, platform instructions and current owner before writing. Do not assume a GitHub reference automatically updated a Windows checkout.

## Product scope

Emily is the product name, not a separate agent identity. It is a single-owner personal Web/PWA radio, independent of the personal main website. A public unbow subdomain is for the owner's cross-device access, not a public music/room service. Mobile-first, with Xiaomi 12S / Android Chrome as usage context. David's latest correction (2026-09-30) explicitly removes physical Xiaomi/lockscreen/PWA testing as delivery gates; prioritise UI/UX redesign from the mmguo reference, not more device acceptance checklists. Keep untested behaviour factual, not falsely passed. Initial hosting is English female, adjustable rather than permanently fixed. Keep visual quality and continuity of the listening experience as real acceptance criteria.

Use the owner's NetEase entitlements, never shared VIP pools, unlocking routes or third-party fallback music represented as authorized. Missing credentials/providers must remain honest setup/error states. Test fixtures must be labelled and never enter the production catalogue or simulated playback progress.

## Source, permissions and secrets

The handoff development branch is `iris/emily-v1-english-20260930`. Do not reset, clean, overwrite or force-push another agent's work. Preserve the three original screenshots. Keep secrets, cookies, QR authorization state, private SQLite data and generated user audio out of Git, logs and chat. `.env.example` is a template only. Real login confirmation belongs to a secure user-controlled flow.

Code handoff/sync was authorized. It does not automatically authorize DNS changes, public deployment, payments, production service restarts or unrelated credential/profile changes. Ask David for the consequential step when needed; do not repeat permission requests for already-authorized local work.

## Verification

Read current known failures in the handoff. Retain the two failing regression tests; don't hide them by deletion, skipping or fabricating provider output. Existing typecheck/build/unit results are not proof of real NetEase account playback, a real model channel, physical phone background playback or product completion.

Use the shared API contract and existing npm workspaces. The default command entrypoint binds loopback. Node's built-in SQLite and explicit `EMILY_*` configuration are already in use; do not add database/agent infrastructure just for ceremony. Mark progress complete only after directly exercising the requested path and recording actual evidence.
