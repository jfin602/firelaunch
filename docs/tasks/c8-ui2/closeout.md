# C8-UI2 P4 — Left rail fullscreen staging closeout

**Observed 2026-10-21 20:23 UTC. Status: UI NOT GREEN / STAGING NOT DEPLOYED.** The exact candidate is built and staged as an incoming archive, but the required new command-scoped operator grant is absent. No c8-ui2 release has been activated or tested in an authenticated staging browser. This status can be revised only after a protected deployment and direct browser qualification of its final active release.

## Source and local checks

- Local branch `main` was clean at source preflight at HEAD `8c49aaefef1309d75d9d50fe372284b5172096d3`; there was no uncommitted source diff. This closeout file is the only new working-tree item. P1 `5247fffa972a94f2df8b8b7b8dc23a9b3829268a`, P2 `6ce0a43f508207a6f82b63bdb6c8be24a14a79da`, and P3 HEAD are the latest intended implementation commits. Their changed paths are confined to Studio source and tests.
- Root `package.json` and both root `package-lock.json` version fields are `0.8.10`. Source and active release each contain 14 core migration files. No P1–P3 server, worker, rights, or publication contract path changed.
- One `npm run test` completed with exit 0, including workspace builds/typechecks, kernel, Studio and runner suites. The kernel suite reported 173 pass, 15 skip, 0 fail; the runner suite reported 104 pass, 0 fail. `npm run codex:stack:validate -- c8-ui2` passed, as did `git diff --check`.
- The archive builder required npm 12; the initial invocation stopped before packaging under npm 11. The successful build used cached npm 12.2.0 without changing the checkout. Its assembled production bundle passed signed-out, fixture signed-in and fresh-tab visible-root browser smoke for both the new and cached active entrypoints. These fixtures are packaging checks, not live staging UI acceptance.

## Exact release candidate and protected host

- Local archive: `/tmp/firelaunch-c8-ui2-p4/firelaunch-c8-ui2-0.8.10-r1.tar.gz`. Incoming copy: `/home/deploy/firelaunch-incoming/firelaunch-c8-ui2-0.8.10-r1.tar.gz` on `muffinos`. Independent local and remote SHA-256: `7660e5facf0bcffbcda6cde8db35e38ebeb699d86c92c40c90ccc313f0a02c65`; the remote checksum companion verified. The archive contains new `index-DoyKbfbh.js` / `index-CPahzcKz.css` and retains current `index-CTb79YTx.js` / `index-D1mlVjJW.css` plus the bounded older asset inventory.
- At readback, `/srv/firelaunch/current` still resolved to the prior c8-ui release `/srv/firelaunch/releases/20261021T193117Z-850e9d93523c`; `/srv/firelaunch/previous` resolved to `/srv/firelaunch/releases/20261021T063137Z-c79a3cc0d478`. `firelaunch-staging.service` and `firelaunch-build-worker.service` both reported active; the HTTPS auth-session endpoint returned the expected signed-out 401. The protected deploy, backup, rollback and library scripts on the host matched the reviewed repository files by SHA-256.
- The approved public release #1 current pointer returned the unchanged SHA-256 `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059` before any attempted deployment. No public publication or native build was requested.
- `sudo -n -l` showed a narrow grant for the **previous** `firelaunch-c8-ui-0.8.10-r1.tar.gz` archive and protected rollback, plus a broad temporary sudo entry. Neither is the required command-scoped grant for this new c8-ui2 archive and checksum. The protected deploy command was not run. Its encrypted predeploy backup, live database schema readback, new active release, and postdeploy rollback proof therefore do not exist for this candidate.

## Live browser gate

Connected Chrome is available, but its existing FireLaunch tabs predate this candidate. No new staging release is active, so no signed-in owner walkthrough, viewport screenshots/measurements, styling or remote placement checks, private save/reload, fullscreen left drawer checks, or browser error observations can be claimed for c8-ui2. Local smoke and the historical c8-ui browser closeout are not substitutes.

**Next gate:** install a command-scoped operator grant for `/opt/firelaunch-staging-ops/deploy-release.sh /home/deploy/firelaunch-incoming/firelaunch-c8-ui2-0.8.10-r1.tar.gz 7660e5facf0bcffbcda6cde8db35e38ebeb699d86c92c40c90ccc313f0a02c65` and `/opt/firelaunch-staging-ops/rollback.sh`; recheck source, archive hash, services and release pointer; then use the protected deploy and qualify the final active release in a fresh authenticated Codex Chrome tab. If this archive is rebuilt, it needs a new checksum and applicable grant.

The prior [c8-ui closeout](../c8-ui/closeout.md) remains UI GREEN / STAGING DEPLOYED for its tested release. P8B Wave 2 native static-layout device proof remains NOT GREEN. Overall Phase 8 remains OPEN; Phase 9 is not activated.
