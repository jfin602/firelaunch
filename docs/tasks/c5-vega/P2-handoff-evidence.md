# c5-vega P2 — HTTPS publication handoff evidence

Date: 2026-10-12. Starting HEAD `cad1e97608e9c5b3dcd29a2a74cf87522c7f366f`; root package and both root lockfile versions `0.6.0`. No release or deployment was created in an owner account during P2.

## Inspected and changed

- P5 checkpoint history P1–P7 is present; historical P5 P8 remains NOT GREEN. P1's repaired, ignored example-bound VPKG exists (541,474 bytes; SHA-256 `e67b696ef8808c841e1d2f4918cf953c85479d450f62155b73d1708124653662`). Its origin/package are fixtures, so it cannot qualify a creator publication.
- Hosted source had owner-scoped `createDeployment` persistence but no authenticated HTTP creation route. P2 adds `POST /api/projects/:projectId/deployment`: strict creator-approved native identity input, server-derived owner/deployment ID, private Studio origin separation, and safe HTTPS resolver-root validation. The existing `GET` route and session/CSRF guard remain. The route does not approve media rights, publish, build or submit an app.
- PostgreSQL migration 010 defines approvals, immutable releases, monotonically advancing pointers and audit. The existing local source database reports migrations **1–9** and lacks publication tables; P2 did not migrate or seed that retained source. The disposable focused integration test created its own database and applied migration 010 successfully.
- The public resolver verifies exact canonical bytes, stored SHA-256, schema/deployment/release/sequence and publishes GET-only pointer/release responses. Pointer ETag hashes pointer JSON, while release ETag equals the manifest SHA-256. The separate TV vhost remains an operator task; [device-runbook.md](device-runbook.md) specifies its allowlist, route negatives, rights review and P3 one-VPKG sequence.

## Direct observations and blockers

Installed Vega CLI `1.4.4`, SDK `main@0.24.12112`; `vega device list` returned **No devices found** during P2. No P2 browser, installed-app run, target-network request or Ngest observation occurred. P1's toolchain build is recorded separately.

No approved separate public TV hostname/TLS/vhost, creator-session deployment, confirmed public artwork/playback rights or staging database migration-10 evidence was available to this P2 run. Accordingly there are **no** live v1/v2/v3 IDs, HTTP responses, public manifest digest, real device reachability or installed-package refresh to report. The existing `firelaunch.jfin.dev` Studio must stay private; do not point a device at it as a substitute for the public-only resolver. P3 needs those operator/creator prerequisites and must close NOT GREEN if they remain absent.

## Focused validation

- PostgreSQL-backed publication owner/API/revision/rollback integration: **1 passed, 0 skipped** using a disposable database. This includes unauthenticated/foreign/CSRF deployment-creation denials and a successful owner-created deployment.
- Public resolver, publication contracts, bound generator and remote-release loader: **15 passed, 0 skipped**. These are local fixtures, not HTTPS or VirtualDevice evidence.
- Affected server typecheck and build passed with Node 24/npm 12; `git diff --check` passed. No full aggregate was run; P3 owns that check.
