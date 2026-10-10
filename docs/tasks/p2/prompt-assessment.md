# p2 — Prompt assessment

Status: approved Phase 2 alignment; source-aware Prompt Stack authored
Date: 2026-10-10
Baseline: root 0.2.0 after P1 GREEN / QUALIFIED at 0.1.5

## Problem / decision

P1 delivered strict CreatorAccount, ChannelOwnership, ChannelDeployment, catalog, media and publication contracts, **not runtime authorization**. Build a hosted creator service with two independently authenticated accounts, Postgres and private storage without inheriting P0's public API/filesystem/CLI assumptions. Seven dependency-ordered checkpoints: six implementations then independent browser/security/recovery closeout. Scoped prompts target <=8 minutes where feasible; complex integration may require bounded handoff, not silent expansion. Default GPT-6 Sol High for security-sensitive work.

## Inspected source seams

- `apps/server/src/index.ts` starts an HTTP server on 127.0.0.1 and constructs file-backed `ProjectRepository`. `api.ts` uses `node:http`, exposes project GET/POST/PUT, mutation/agent, code/file read/save, generate/build/readiness/bundle and agent-status; there is no authentication middleware or current-owner context.
- `repository.ts` stores `project.json` beneath `.firelaunch-data/projects/ch_*`, validates paths/symlinks and serializes same-process updates with a Map lock. That is neither durable Postgres CAS nor tenant isolation.
- `workspace.ts` reads/writes creator generated source and can spawn local toolchain commands. This is unacceptable across creator trust boundaries on a shared hosted host. Hosted mode denies build until isolated execution is separately qualified; keep P0 local mode clearly gated.
- Studio currently assumes unauthenticated list/create/project access. Its login/loading/401/403/session-expiry and tenant-safe project switching must be adapted minimally without redesigning the TV editor.
- P1 contracts from `packages/contracts/src/creator.ts` and `index.ts` are validation authority. ChannelSpec v1, TV projection, agent mutation validation, code-edit preservation and source-export semantics remain intact.
- The runner's `p2` family requires Phase 2 versions 0.2.1 through 0.2.7; final P7 has an explicit `closeout` filename/title and browser-required metadata.

## Decisions

1. **Identity:** implement provider-independent OIDC verifier; Google is the first documented live issuer. Verified subject maps to a server-issued CreatorAccount. Use authorization-code/PKCE, issuer/audience/signature/time, state/nonce, secure httpOnly SameSite cookies, CSRF protection, session expiry/rotation/logout. Deterministic mock OIDC only in isolated tests, never as hosted fallback. No password storage or Amazon developer credentials.
2. **Persistence:** Postgres with versioned migrations, account/project/deployment foreign keys and globally unique package IDs. Database transactions enforce revision CAS and ownership, including concurrent writes and cross-account duplicate attempts. Do not trust `creatorId` or `permission` from JSON.
3. **API:** enforce authentication and ownership at handler/service/repository boundaries for every endpoint including read/list/mutate/agent/generate/code/file/save/build/readiness/bundle/export. Cross-account retrieval returns no private metadata. Decide explicit local/hosted mode and fail closed; do not accidentally bind public APIs with local unauthenticated behavior.
4. **Assets:** private S3-compatible object interface for uploaded asset/evidence metadata and secrets references. No general P3 uploader/catalog ingestion or public P5 manifest endpoint. Token and key content stay out of exports/logs/ChannelSpec.
5. **Migration:** explicit, owner-selected P0 importer, dry run by default, idempotence markers, no damage to local source, preserve custom code and revisions, reject symlinks/invalid data/identity collisions, no automatic inherited ownership.
6. **Operations:** transactional audit/monitoring for auth failures, storage failures, migrations, recovery; working database + object backups, restore into disposable isolated namespace; limited owner deletion/export primitives now, self-service/billing later.
7. **Qualification:** two live separate sessions/accounts, adversarial route and signed-object isolation, restart, concurrency, migration, restore, browser login/editor regression, aggregate check. Authentication test bypass and purely mocked DB/asset results are not equivalent to live hosted GREEN.

## Risks and non-goals

- High: accidental local P0 route availability on public interface, broken owner binding on file/agent/build subpaths, cookie/CSRF proxy misconfiguration, shared untrusted CLI execution, orphaned object refs, transaction race across processes, unsafe migration of overridden files, irrecoverable half-snapshots.
- Non-goals: Amazon connector/OAuth, P3 CSV/feed parsing and catalogue editor, P4 catalog grounded AI, P5 live manifest delivery, P6 sync workers, P7 billing/Console and full account UX, team roles, physical Fire TV. Historical P0/P7 and c0 NOT GREEN.
- No AWS, Bedrock, supported physical Vega build host or Appstore approval required for P2; real OIDC and a runnable SQL/storage recovery environment ARE required to claim its own GREEN.

## Phase acceptance

GREEN only with documented real account A/B isolation, correct Postgres uniqueness/CAS under concurrent tests, leak-safe hosted file/agent/build boundaries, actual signed-object/evidence isolation, restart and reproducible Postgres+object backup/restore, bounded P0 import/customization survival and saved browser evidence. Fail truthfully and propose bounded c2-* correction if blockers remain.
