# Q2 five-cycle qualification — Cycle 5/5

Date: 2026-10-19 02:34 UTC. **Cycle 5 result: PARTIAL; Q2 overall NOT GREEN.** Cycles 1–4 and the original Q2 closeout were read. No Q3 execution, VPKG build, extra encode, publication, revocation, AWS change or release #1 modification occurred in this loop.

## Independent gate review

| Gate | Result | Basis and limit |
| --- | --- | --- |
| F5 — bounded FREE viewer policy | **PASS / GREEN** | Cycle 1 directly verified separate scoped AWS principals, deployed CloudFront/OAC/private S3 path guard, IAM boundaries, processing state and cost alert. Cycle 2's single actual staging app-role `PutObject` attempt to a synthetic canonical delivery key returned an explicit identity-policy `AccessDenied`; the object remained absent. Retained Q2 positive/negative CDN and S3 HTTPS evidence applies to approved release #1. No paid or general future-video delivery claim. |
| F6 — owned immutable release | **PASS** | Retained Q1/Q2 creator approval, exact READY synthetic rendition, public-only resolver, seven Q1-matching CloudFront HLS objects, release #1 `rel_99483e7fc9f0438c858b90c5db77d06c`, sequence 1 and SHA-256 `b7336f0807a49232be2b5575cbaf94808db45afe57b37b663f1b6473f5d09426`. Cycle 1 relisted exactly those seven objects; Cycle 3 read the unchanged release metadata in the owner Studio UI. No unnecessary seven-file redownload. |
| F7 — revocation and isolation | **PARTIAL / NOT GREEN** | Cycle 3 observed simultaneous real A/B Google sessions and B's UI redirect away from A's project, plus anonymous boundary checks. Browser clients blocked direct private API navigation before HTTP responses, so authenticated foreign-owner/write/private-capability/wrong-CSRF API results remain absent. Cycle 4 found no eligible disposable rights-approved second media fixture; therefore no live revocation, publication-denial or CDN invalidation/cache observation was made. Offline tests and source inspection remain supporting, not substitute, evidence. |

## Studio CSS repair

The earlier Studio failure expected `studio-canyon.svg`, while committed `bf4ed45` intentionally changed `apps/studio/src/style.css` to load `desert-canyon.webp` and added that WebP asset. The test was stale; the production CSS and image were left untouched. The narrow change to `apps/studio/test/preview.test.tsx` now asserts the actual CSS URL and the referenced asset's RIFF/WEBP signature. The test still checks reduced-data behavior, TV theme isolation, creator colors and directional focus. Focused run: **5 passed / 0 failed / 0 skipped**.

## One final source-bound aggregate

Node `v24.21.0`, npm `12.2.0` selected through a temporary local PATH shim for top-level and nested workspace scripts. Exactly one `npm run check` was run after the focused repair, exit **0**. All seven workspace typechecks and all seven builds passed. Studio Vite build passed; it emitted only Rollup comment-annotation notices for Zod dependency code.

| Suite | Passed | Failed | Skipped | Total |
| --- | ---: | ---: | ---: | ---: |
| Kernel | 127 | 0 | 15 | 142 |
| Studio | 40 | 0 | 0 | 40 |
| Runner | 104 | 0 | 0 | 104 |
| **Combined** | **271** | **0** | **15** | **286** |

The 15 kernel skips are environment-gated real PostgreSQL/MinIO integration cases; they are not live staging F7 proof. Full aggregate output was retained outside the repository at `/tmp/firelaunch-q2-final-check.log`. `git diff --check` passed. The final check does not turn unobserved live F7 cases into a pass.

## Candidate identity and changes

- HEAD `3eba83ffbe71646cd0e5b46a95d9b0f06707f264`, root version `0.6.7`, no commit or HEAD movement.
- Only source/test edit: `apps/studio/test/preview.test.tsx`, final Git blob `298a5b937ebe6a88f65b109841bc7977e30a6817`, SHA-256 `cad3468ced49fc9010155ff3d3e6137d13615099262dc87a1864b23fedfc515c`. The CSS SHA-256 is `27d816e514946a7e821340631323df22b66a86ad76ac66aa98b30d59c91c1cc3`; the referenced WebP SHA-256 is `535ca744d89c66c3bda34d2dfc4e678879a3cc69e10661245df43f1f9c3342fd`. Neither CSS nor WebP changed in this loop.
- Documentation added: `qualification/q2-five-cycle/cycle-1.md` through `cycle-5.md`; `Q2-closeout.md` receives a dated append below. The test-only local change was not deployed. Existing live evidence remains bound to the previously deployed staging release recorded in the Q2 closeout, rather than falsely to this local test blob.

**Final disposition: Q2 NOT GREEN.** A supported way to issue and observe authenticated private API/CSRF requests from the two live sessions, plus a separate disposable rights-cleared fixture, remains necessary to finish F7. Release #1, public master, manifest pointer, creator data, AWS resources and service state were preserved. Q3 remains unstarted.
