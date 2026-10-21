# P6 full-screen Preview handoff

Pre-task HEAD: `339f8fe`. Root package was `0.8.9`; both top-level lockfile version fields were still `0.8.7`. P6 aligns all three to assigned `0.8.10` in the uncommitted working tree. No schema, native Vega player, rights, publication, or deployment change.

Channel's **View full screen** button requests browser fullscreen on the existing Preview container from its click handler. A denied or unavailable API opens a viewport dialog using the same mounted Preview, TvState, and player. Escape exits the expanded view; Backspace and the visible remote remain TV Back. Browser `fullscreenchange` exits and restores trigger focus. The fallback makes Studio controls inert and traps Tab within Preview. Project changes close expansion and mount the new project's Preview normally.

Studio typecheck, `preview.test.tsx` plus `shell.test.tsx` (15 focused tests), and `git diff --check` passed. Tests cover API success/rejection, unavailable fallback, repeated entry/exit, browser-driven exit, focus return, one Preview/player, D-pad/Back and playback preservation, and project switch. Actual browser Fullscreen API permission, focus behavior, responsive fit, and mobile/touch accessibility remain unverified until P7's real browser acceptance. No native or staging run occurred.
