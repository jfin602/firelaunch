# P9 Polish — prompt assessment (2026-10-22)

**Owner transition:** Phase 8 CLOSED by owner with outstanding evidence carried; P9 base is 0.9.0, P1–P10 manual issue prompts increment to 0.9.1–0.9.10. P11 final evidence-only. Supersedes older notes that Phase 8 owner closure is pending; does not rewrite historical NOT GREEN findings.

## Decision
**Ten manually executed, independent issue-targeted prompts** with one post-deploy authenticated Codex-browser verification per prompt, plus one final integrated smoke/closeout. No runner, no `/activate`; each implementation owns its own version, commits, staged exact SHA and issue evidence. Old installed-client publishing moved to [deferred Phase 10](../p10/README.md).

## Baseline
Current `main` at review has root/lock `0.8.17`, current schema 15. P8D Phase 8 overall NOT GREEN; `c8-hero-multimedia` correction at unchanged 0.8.17 remains a dependency. This is dated GitHub evidence, not a fresh local/staging preflight. The owner authorized a Phase 9 scope pivot, **not retroactive Phase 8 qualification**.

## Additional P0 correction P9-011 — independent from mainline P1–P11

Owner identified that P8D Audio and Book Library records are absent from Channel > Pages & Layout > Edit Section's `Choose content` list. [P9-011](../p9-polish/issues/P9-011-mixed-media-sections.md) and [c9-multimedia-editor](../c9-multimedia-editor/README.md) define one dedicated manual Sol High prompt with protected staging deploy and real owner browser, plus native parity where available. It reuses Video/Audio/Book ChannelSpec bindings and TV player, not new section layouts or an extra app framework. P9-011 is P0 and must be assessed independently before P11; no P1–P10 version renumbering. As with other P0s, NOT GREEN must remain visible if native media delivery is unqualified.

## One-issue partition
1. **P9-001** Simple creation, low risk, one route/form.
2. **P9-004** One-time rights attestation, use persisted per-media record rather than new legal gate, broad labels/screens; must precede P9-002 where practical.
3. **P9-002** P0 private-inventory-vs-included channel distinction with real preview/export parity and eligibility.
4. **P9-007** Shared visual modal shell across actual MVP popups, foundation for new P9-006 dialog.
5. **P9-006** High-complexity shared secure image uploads + global/per-page backgrounds/logo/section assets; run after modal standard.
6. **P9-008** Aspect-safe foreground artwork, tied to P9-006 and hero correction without changing decorative-background cover.
7. **P9-005** Compact, animated, accessible section editor reorder; keep actual page/layout persistence and native parity.
8. **P9-010** Library categories + reusable non-content assets, based on *finished actual* P8D source and P9-006.
9. **P9-003** Home actions, using now-valid Library entry and same existing fullscreen Preview.
10. **P9-009** Login styling with owner-approved actual 16:9 canyon image from conversation; auth safe; visual reference asset must be explicitly supplied if absent in repo.

P11 does a single whole-product browser walk, one final aggregate and limited native/export smoke; no new features.

## Risk handling

- Biggest technical risk **P9-002/P9-006/P9-010** (source of truth / private media auth / native export). Do not lower acceptance to UI-only for those features.
- Highest visual risk **P9-005/P9-007/P9-008**. Browser screenshots and actual keyboard/layout behavior required, not merely unit tests.
- **P9-009 image** has been approved, but is not yet committed as a binary; attach/recover exact conversation-generated asset rather than swapping stock image.
- Different media behaviors: video Watch, MP3 Listen, Book Showcase (book-only no Play; attached audiobook shares audio player). Don't resurrect old catalog import or claim an EPUB reader.
- P9-004 confirmation must persist without bypassing real storage security, rights revocation or media-ready checks.
- P9-002 is channel membership for current draft/fresh export only; P10 handles live remote installed-client updates.
- Existing staging access is host-privileged. Do not run arbitrary scripts/migrations; verify SHA, encrypted backup, current schema, rollback, worker and public approved release #1.
- Some individual issue scopes may take longer than an eight-minute target; one-issue partition is preserved and blockers are **reported**, not concealed by splitting into unrelated uncontrolled changes.

## Qualification rule
Each issue: inspected baseline -> changed scope tested -> committed candidate -> **protected deployed** -> real authenticated browser -> evidence commit. Scoped GREEN only when all issue-relevant checks pass. Missing/stale deployment, missing image asset, native renderer proof, forbidden schema migration or rights regressions = accurate NOT GREEN/BLOCKED and a recovery handoff. No phase-level claim until P11.
