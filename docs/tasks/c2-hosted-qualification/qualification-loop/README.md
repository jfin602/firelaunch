# c2 hosted qualification evidence

Two of five allowed cycles have been attempted at unchanged root version `0.2.7`. [Cycle 1](cycle-1.md) stopped before external configuration was available. [Cycle 2](cycle-2.md) used committed local hosted setup and two owner-approved real Google account aliases. Original P2 P7 results remain historical context, not c2 proof.

Cycle 2 used Node 24.21.0, npm 12.2.0 for the root check, PostgreSQL 16, and private distinct MinIO S3 buckets. The Google issuer/client were real, but the browser callback and S3 endpoint used HTTP loopback under an explicit development exception. Only one in-app browser profile was available. The two accounts completed login sequentially. This is local integration evidence, short of the required HTTPS separated-profile qualification.

Raw logs, the encrypted recovery archive and one-off drill script are ignored under `.codex-runs/c2-hosted-qualification/` (directory mode 0700; archive and logs mode 0600). The local environment file is ignored with mode 0600. Public records contain aliases, counts, hashes and sanitized results, not email addresses, OAuth tokens, credentials, database URLs, private object keys or private media.
