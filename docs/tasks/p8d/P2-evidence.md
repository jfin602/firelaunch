# P8D P2 — Audio upload and private listening evidence

**2026-10-22 — SCOPED GREEN for Studio Audio; staged at 0.8.15/schema 15.** This is a P2 browser and private-media result. Native Vega audio, public delivery, mixed-media publication and final Phase 8 closeout remain for P4/P5. [P8C's historical NOT GREEN result](../p8/closeout.md) is unchanged.

## Source and limits

- Runner P1 predecessor: `f47cf63` (`0.8.14`). P2 source/version checkpoint: `92ae3ea` with exact subject `0.8.15`; root package and both root lock version fields are `0.8.15`. Scoped browser repair: `1fe2a03` preserves rights selections when the newly created catalog item first arrives during save; it includes a regression test.
- Add Audio creates one private audio `CatalogItem`, with artist, optional description/album/episode/track, square cover, album or playlist, and separate TV display and MP3 playback rights. The common `AudioPlayer` serves this standalone Audio path and is available for P3's same-book audio. Save/reopen, duplicate handling, replacement and revocation remain owner scoped.
- The authenticated private MP3 ingress caps an upload at **320 MiB** and validates its bytes, codec and **7200-second** duration server side. The general private-object ceiling remains 1 MiB. Schema 15 permits the larger size only for audio objects; owner-only ranged preview requires a current, non-revoked attached asset. An uploaded private MP3 is neither approved for public delivery nor live.
- The staging Nginx audio endpoint alone permits a `321m` body. Other routes retain their previous request cap. This schema and Nginx change was separately authorized by the owner for two-hour audio.

## Validation

- Focused real PostgreSQL 16 tests passed: private objects, recovery and audio upload (including a schema-15 large-audio record without widening other private types). Studio Audio tests and the 85-test Studio suite passed. Server/Studio typechecks, contracts build, server/Studio builds, production Studio smoke and `git diff --check` passed. `npm run codex:stack:validate -- p8d` passed before rollout.
- A synthetic owned MP3 fixture was generated outside Git: `21,540,433` bytes, SHA-256 `56280bec9d987ccc67d9de9d61e8dab4d7d7ac9f79d3dda811fbb5f900e6347c`, `ffprobe` duration `7180.068571` seconds (119:40), with a square PNG cover. It verifies near-two-hour duration in the owner workflow. A 320 MiB network upload was not performed; the ceiling is covered by server and schema validation.

## Protected staging

- Baseline was active `20261022T121551Z-2c71e540400b`, version 0.8.13/schema 14. The first one-time schema rollout stopped before cutover when its isolated restore rehearsal could not read the protected dump. The rehearsal was fixed to stream the dump into `pg_restore`; no failed candidate was promoted.
- The successful one-time schema 14→15 rollout used committed source archive SHA-256 `6a2a435657068121fe5147e363d4071fac9b2e870cbf15d91e6bb6ae8e3fa62c`, active release `20261022T141536Z-6a2a43565706`. Its pre-migration encrypted backup was `/var/backups/firelaunch-staging/20261022T141536Z-6a2a43565706-pre-audio-schema15-schema-14.flrec`, SHA-256 `c3721d81edca6bde05a4a961abfc624eb1878cd01aa8ec1238a44ceece9a05a3`. The isolated database/object restore rehearsal passed; Nginx syntax test and reload passed.
- The browser repair was built from `1fe2a03` and deployed through the standard exact-hash guarded path using archive SHA-256 `dd19a64b527b50973fcbc0bd941c584852e38a5bb0cb516cf841631f01c7df46`. Active release is `20261022T142520Z-dd19a64b527b`, schema 15→15. Its encrypted verified pre-deploy backup is `/var/backups/firelaunch-staging/20261022T142520Z-dd19a64b527b-pre-deploy-schema-15.flrec`, SHA-256 `355925fd31c658abd2ab907772628f220e0ae8ef6c082982186444d13159f8b3`, mode `600` and root owned. The previous release pointer is the first schema-15 release; staging and build-worker services are active, and Nginx syntax is valid.
- Current staged `index.html`, JS `index-DuxbQ5Vb.js` and CSS `index-7P0ru5AM.css` hashes match the tested local build; both HTTPS assets return 200 with expected MIME types. The existing FREE release #1 public pointer still hashes to `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059`. No production, AWS policy or public-media change was made.

## Signed-in owner browser

- Used the owner's chosen Jacob Pickens Google account on `https://firelaunch.jfin.dev/` and the existing private `P8C P2 Private Flow 2026-10-22` project. Uploaded the synthetic MP3 and square cover through Add Audio, asserted the separate rights, created `P8D Private Test Album`, saved, closed and reopened. Library showed one private Audio item attached to that album; both rights remained checked and the status read **MP3 uploaded privately · TV display cleared · TV playback cleared · Delivery blocked · Live no**.
- After the repair deployment and fresh sign-in, the saved item remained present. Private listening loaded duration `119:40`; Play changed to Pause, forward seek advanced the position, and pause returned to Play. Browser warning/error logs were empty. The owner preview expressly stated it was not a live TV release.

## Handoff

P2 is ready for runner prefix recognition and the P3 browser-required stop. P3 can attach optional audio to the **same** Book item and reuse `AudioPlayer`; no native or public audio qualification is asserted here. Backup preflight currently caps the staging recovery payload at 600 MiB and fails closed if future accumulated private media exceed that bound, so storage growth requires an operator capacity review before further large collections.
