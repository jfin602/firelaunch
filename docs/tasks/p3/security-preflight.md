# Phase 3 — Optional live browser security test guide

Status: OPTIONAL DURING IMPLEMENTATION / REQUIRED EVIDENCE FOR FINAL LIVE QUALIFICATION

This document is no longer a prerequisite to running the Phase 3 Prompt Stack. Do not require a manual two-browser-profile Google preflight or a security-preflight-evidence.md file before P1. P1 uses focused automated security tests to qualify its bounded checkpoint. Successful fixture tests are NOT evidence of real Google identity qualification.

For Phase 3 P8 independent browser qualification, use two authorized real Google accounts in separate simultaneous browser profiles against the same hosted candidate. Verify positive owner access and foreign denial for projects, code, export, agent/status, readiness, hosted Build, and private-object capabilities. Include new P3 catalog/import/media endpoints, cookies, CSRF, session expiry, logout and restart. Use correct per-session CSRF values on writes; do not mistake CSRF rejection for a proven ownership denial. Hosted Build remains blocked.

Record only redacted results, timestamps, HEAD and test classes in the P8 closeout; keep tokens, cookies, credentials, emails, CSRF values and private object keys out of committed evidence. HTTPS staging OIDC/secure-cookie and independent private HTTPS S3 recovery remain separate preproduction gates. If any required live test cannot run, report it OPEN and do not claim full hosted security or release GREEN. Preserve the historical P2/c2 NOT GREEN closeouts.
