# VegaLaunch rebrand qualification — 2026-10-23

**Result: NOT GREEN.** VegaLaunch is the active product brand in newly generated code and the deployed Studio. Two creator-owned historical values remain visibly old, and installed Vega / live export qualification did not pass.

## Source and local validation

- Product commit: `e3bad07a0442aa8d81eec0b24492e0c8a669d57a` on `codex/vegalaunch-rename`; root and both lock versions `0.9.4`. The product commit changes 100 files. No schema migration or version bump.
- Full typecheck passed. `npm run test` passed **401**, skipped **16**, failed **0** (kernel 194/16, Studio 101, runner 106). All seven workspace production builds passed, including Studio and server. Eight staging-helper tests passed. The production Studio smoke passed signed-out, fixture signed-in, fresh tab, and assembled archive entrypoints.
- A fresh generated synthetic Vega project built as an x86_64 Release VPKG with SDK `0.24.12112`, CLI `1.4.4`, zero manifest errors, package `com.vegalaunch.channel.ch_11111111111111111111111111111111`. With graphics acceleration, one VirtualDevice `install-app` completed successfully. The device then disappeared between CLI calls; subsequent `launch-app` returned `Device not found` or `App could not be determined`. No native render, navigation, or moving playback is claimed.
- The final search found no old product word in Studio presentation, generated app metadata, or TV presentation source. `firelaunch` remains in technical compatibility keys and historical records listed in [the audit](../../rebrand-compatibility.md). Built Studio JavaScript retains only the old private draft storage key, not visible product copy.

## Protected staging deployment

- Exact clean committed archive: `firelaunch-vegalaunch-0.9.4-e3bad07.tar.gz`, SHA-256 `eddc471ae38dac4eb7b483375c9d7b447eab6935bf05eb60f856d71f909da545`. Matching incoming checksum verified before the installed guarded deploy command.
- Active release: `/srv/firelaunch/releases/20261023T131759Z-eddc471ae38d`; schema **15 → 15**. Previous rollback: `/srv/firelaunch/releases/20261023T113149Z-a10d0ea94263`. Protected encrypted backup: `/var/backups/firelaunch-staging/20261023T131759Z-eddc471ae38d-pre-deploy-schema-15.flrec`, operator-verified SHA-256 `8bf80c9cee5c3e27bf179d7a9238b28b26bd2254c4214f7bf51f43156e74963d`, 36 objects.
- API and isolated worker remained active. Local and active `index.html`, main JS, API entrypoint, and hosted repository hashes matched. HTTPS Studio and JS returned 200; unauthenticated session returned 401. No recent error-level journal entries or browser console warnings/errors were observed.
- The approved public release #1 pointer SHA-256 was `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059` both before and after deployment. No public release, MediaConvert job, AWS policy, Nginx, database, or installed app was changed.

## Authenticated browser checks

- On configured `https://vegalaunch.jfin.dev`, Google account chooser and callback authenticated the existing owner. `snabble tv` loaded at revision 36 with eight previous projects. Home, Library, Channel editor, Preview, and Export opened. The tab title and sign-in page read **VegaLaunch Studio** / **Sign in to VegaLaunch**.
- Created private qualification channel `ch_e620cb047ada42b09c2529580405b7f8`, renamed it through Appearance, and confirmed revision 2 and the saved title after reload and after explicit sign-out/sign-in. Nine projects were then present. Fresh private source generation listed `vegalaunch.json`; `app.json` contained the new `com.vegalaunch.channel...main` ID and saved title.
- Existing `snabble tv` TV Preview showed hero/row, opened `AV Test In HD`, and played it with `readyState=4`, `currentTime>1`, `paused=false`, 854×480 frames, and no video error. Back restored the selected row. This is Studio browser playback, not installed Vega playback.
- The Add Video private form loaded with rights confirmation and a disabled upload button until a file is selected. No new media upload or paid encode was performed. Export loaded an **expired pre-existing job**; no new public release or worker build was submitted.

## Remaining gates

- A saved private media title still reads **FireLaunch Staging Video Qualification 20261017T0300Z**, visible in Home and Library. An older creator-owned generated source tree for `snabble tv` still lists `firelaunch.json`. These records were left intact to preserve creator data and historical evidence. Fresh generated source uses `vegalaunch.json`.
- The old `https://firelaunch.jfin.dev` host serves Studio, but `/api/auth/login` returns 400 because the configured OAuth origin is the canonical `https://vegalaunch.jfin.dev` (whose login returns 302). Existing old-host bookmarks need a separately reviewed redirect or migration path.
- Native launch/visual/playback, a fresh live ZIP export, a real upload, and full media-reference matrix remain unverified. One disposable VPKG install succeeded, but that alone does not pass native qualification. No GREEN claim is made for those gates.

The guarded rollback target is the previous schema-15 release above. Do not roll back merely for these historical creator-data references; the deployed candidate passed its runtime checks.
