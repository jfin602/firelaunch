# Phase 3 — Mandatory local security preflight

Status: INSTRUCTIONS ONLY — NOT EVIDENCE OF PASSING

Before running P3 P1, open two truly separate browser profiles and authenticate with two authorized real Google accounts at the existing local hosted FireLaunch Studio. Sequential use of Google's account selector in one browser profile does not meet this gate. Use the local PostgreSQL and MinIO environment documented under docs/tasks/c2-hosted-qualification/local-mint.md.

Confirm that both authenticated profiles stay active simultaneously. Each account must see its own projects and fail to access the other account's project, code, export, agent, readiness, Build and private media/capability actions. For write tests, use each session's correct CSRF value so an authorization denial is not confused with a CSRF error. Confirm logout/session behavior, retained project edits after restart, and protected source export. Note that hosted Build should remain blocked; deployment APIs not implemented must be marked unsupported, with ownership verified at the database boundary where relevant.

Only after actual testing, write docs/tasks/p3/security-preflight-evidence.md with redacted account aliases, date, source HEAD, tested route categories, observed positive/negative results and S1/S2/S3 actual PASS or FAIL/BLOCKED status. Store sensitive raw test material under ignored .codex-runs/p3/security-preflight, not Git. Never write OAuth tokens, personal account addresses, cookies, CSRF values, passwords, database URLs or private object keys into tracked evidence.

P1 must read this actual report and check its credibility and focused regression tests. If no two-profile real-login and local tenant-denial proof exists, or an owner-boundary check fails, P1 must stop without advancing version or checkpoint-committing. The separate HTTPS staging S4/S5 gates remain OPEN unless directly tested and may be carried to P8.
