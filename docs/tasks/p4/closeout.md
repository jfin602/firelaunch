# Phase 4 / P8 independent catalog generation closeout

Date: 2026-10-11 CDT. **P4 NOT GREEN. HOSTED RELEASE NOT QUALIFIED.** Starting and final HEAD: `2aff7d8379375c269fb734752bb90145f80d005f` (runner-owned P7 checkpoint). Starting root version `0.4.7`; this uncommitted closeout advances only root `package.json` and the two root `package-lock.json` version entries to `0.4.8`. The initial working tree was clean. No commit or HEAD movement was made; internal workspace versions are unchanged.

## Checkpoints and inherited gates

The committed P4 sequence is P1 `32856fd30e5691f406c79457ce4d935fa2d4db08`, P2 `45f205dbf8cd4717786a7d33668eddd29c39e5f3`, P3 `59a41b7c665b3845ae774445d425548fdb86513c`, P4 `3165abe762348b50a6e9e76e6c764b3f66ed0f32`, P5 `3829b8fe28dc9acf69955adc93f4a0a4b72cfda8`, P6 `da457095c0a95f103d57055a7e22c3e2c1a93edd`, and P7 `2aff7d8379375c269fb734752bb90145f80d005f`. P7's provider and three-creator convergence evidence used deterministic fixtures, not live model or browser proof.

P2 P7 stays NOT GREEN; c2 stays BLOCKED / NOT GREEN. P3 stays CATALOG GREEN for its bounded local workflow / HOSTED RELEASE NOT QUALIFIED. Historical P0 P7 and c0 remain NOT GREEN. This P4 result changes none of those dispositions.

## Direct browser observations

The local hosted server used the existing Google OIDC configuration, PostgreSQL and private loopback MinIO. The Codex in-app browser exposed one profile. One of two existing Google account choices completed sign-in; account selection for the other hung on Google's loading screen. Only one real identity and one browser profile were usable for this P8 run. The local server was restarted once; the process-local session ended as expected and the same identity reauthenticated successfully on a later attempt.

| Experience | Observed browser result | Limit |
| --- | --- | --- |
| Writing | Created a private project, imported `fixtures/writing.json`, previewed 2 creates / 0 issues, approved 2 draft items, selected the book, and generated distinct Author and Bookshelf pages at revision 2. Preview showed the informational book detail. Virtual remote Select stayed on detail; Back returned to the page. Saved display name at revision 3 and author text at revision 4. Repeat Generate saved revision 5 with 0 added / 0 updated / 0 removed and retained both edits. Reload and server restart plus reauthentication showed revision 5, the book, edited name and edited module text. | Virtual remote Down was exercised, but the accessibility tree did not establish a visible focus move; D-pad focus qualification is incomplete. No companion reading was licensed or played. |
| Video | Created a separate private project, imported `fixtures/video.json`, previewed 3 creates / 0 issues and approved 3 draft items. Selecting the film displayed “1 selected audio/video item(s) lack eligible playback media or rights. They will be excluded.” | Fixture metadata grants no rights and contains no playable file. No video draft, eligible playback, film focus/detail flow or manual regeneration was qualified. |
| Audio | Created a separate private project, imported `fixtures/audio.json`, previewed 2 creates / 0 issues and approved 2 draft items. Selecting the album track displayed the same rights/media exclusion. | No licensed track or public delivery asset was supplied. No audio draft, album control, listening flow or manual regeneration was qualified. |

The observed writing Preview was private and described device playback as separately qualified. The video/audio records remained draft inventory and the UI excluded media without eligible rights. No browser source export, complete private token/evidence leakage audit, public delivery, or two-account foreign API denial matrix was completed. Focused automated projection, hosted auth, convergence and export tests provide fixture evidence only.

## Live provider disposition

**No non-mock provider request was made or saved.** The local hosted server environment contained Google OIDC credentials but no `FIRELAUNCH_AGENT_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, or Bedrock model setting. The opt-in provider smoke therefore could not make an authorized successful model call. There is no observed provider transport identity, grounded `inspect_catalog` proposal, schema-validated applied tool action, saved live revision, or live-provider Preview effect. Provider adapter fixture tests are not substituted for this gate. P4 cannot be GREEN under ADR 0008.

## Validation

Node `v24.21.0`; the final root check used npm `12.2.0` from the cached npm CLI. Tests with PostgreSQL used the existing loopback database. Logs are local `/tmp` artifacts, outside Git.

| Check | Pass | Fail | Skip | Result |
| --- | ---: | ---: | ---: | --- |
| Focused catalog convergence, projection, grounding, auth, agent and TV tests | 21 | 0 | 0 | Passed; `/tmp/firelaunch-p4-p8-focused.log` SHA-256 `0f12f3df9b6ae011823bdfc63a2dad386edbc0c8825460658660c360a725e702` |
| **One** final `npm run check` kernel stage | 95 | 1 | 1 | Failed; recovery test expected migration 7 but repository health returned migration 9. `/tmp/firelaunch-p4-p8-check.log` SHA-256 `2df4907da80a16b2c4de401c6651a370d146709fb021795fdbb7bea4edf3487f` |
| Studio suite, run separately after aggregate stopped | 18 | 0 | 0 | Passed; `/tmp/firelaunch-p4-p8-studio.log` SHA-256 `0361cd1f5939aed8b595708c8f676b05c80c926755a3b27c77815e3a9369fe05` |
| Runner suite, run separately after aggregate stopped | 104 | 0 | 0 | Passed; `/tmp/firelaunch-p4-p8-runner.log` SHA-256 `c8f90762878c2284bb946e1dbb34d4d44dcc4de80d46094da53c284433f7403f` |

The root check completed **7/7 workspace typechecks and 7/7 workspace builds** before the kernel failure. Studio and runner did not execute inside that aggregate; their separate results must not be counted as a passing root check. The 21 focused tests overlap kernel coverage. `npm run codex:stack:validate -- p4` reported VALID with P1–P8 and manual P8 closeout. Targeted live provider smoke: 0 executed, skipped for absent provider configuration. `git diff --check` passed after the final documentation/version edits.

## Decision and bounded corrections

P4 is **NOT GREEN** because its required live, catalog-grounded non-mock saved mutation was unavailable; video/audio browser drafts and playback were unqualified; and the aggregate has one failing recovery assertion. The recovery failure is a concrete test/repository migration mismatch (`7` expected, `9` observed), not evidence that the recovery workflow itself passed or failed. A bounded follow-up should verify the current migration contract, correct that assertion if appropriate, and rerun the aggregate. A later independent qualification needs an authorized server-side provider key/model, rights-documented reachable HTTPS video/audio test media, full three-type browser navigation and edit/restart checks, and the exact live provider proposal/save/Preview trace. No implementation repair or provider configuration was added in this closeout.

Hosted release remains **NOT QUALIFIED** separately: S1 simultaneous two-profile real identity/session negatives OPEN; S2 live owner/foreign API and capability denial matrix OPEN; S3 browser persistence/export across both accounts PARTIAL; S4 approved HTTPS Google callback and secure-cookie staging OPEN; S5 independent HTTPS private S3 restore OPEN; S6 complete live catalog endpoint security PARTIAL. Automated two-principal and local persistence tests do not close those gates. No physical Fire TV, VPKG, Appstore, production hosting or public TV delivery claim is made.
