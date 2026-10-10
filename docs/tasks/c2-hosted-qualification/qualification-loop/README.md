# c2 hosted qualification evidence

Cycle records cover only attempts made against the committed `0.2.7` candidate. The original P2 P7 closeout and its 179/179 aggregate and 10/10 focused results are historical context, not c2 proof.

Environment observed on 2026-10-10: local Linux workspace, Node 24.21.0, npm 11.19.0 on PATH and npm 12.2.0 available for the declared engine range. PostgreSQL accepts connections on loopback; no c2 database access was configured. The session had no configured hosted FireLaunch deployment URL, Google OIDC client settings, approved pair of real test identities, S3 source/restore buckets or recovery credentials. The owner confirmed those approved external resources are unavailable for this run. No private account or object data was accessed.

The per-cycle record links each gate to direct observations. Raw validation output is kept under ignored `.codex-runs/c2-hosted-qualification/` with directory mode 0700; public records omit credentials, email addresses, tokens, object keys, database URLs and private media. An in-app browser attempted the usual local Studio port only to establish whether a target existed; it returned connection refused. No real Google sign-in, S3 call or recovery operation was attempted.
