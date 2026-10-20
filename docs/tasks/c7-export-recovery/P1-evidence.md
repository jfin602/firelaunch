# R1 Studio startup evidence — 2026-10-20

**Disposition: local bundle mitigation verified, original incident cause NOT VERIFIED.** No protected release was deployed. The source work adds a browser-render gate and carries only active-entrypoint hashed assets into the candidate so previously cached HTML can still load its module. It does not change the active 0.6.7 service or claim that the original browser's missing console trace has been recovered.

## Source and host readback

- Clean starting checkout: `ed238b90fdd4c6a401efba58a25a4ddd75af0bfd` on `main`, matching a fresh read-only GitHub `origin/main` readback; P7 checkpoints `661ba6e`, `779d17f`, `0cec1c7` and committed closeout repair `88257d4` were present. Root package and both top-level lock version fields stayed `0.7.3`. No concurrent dirty work was found.
- Read-only SSH: `/srv/firelaunch/current` still resolved to `20261020T142148Z-37c79817cd97` (0.6.7); `/srv/firelaunch/previous` resolved to failed `20261020T172052Z-2cb3ffa536d0`. The failed release's JS SHA-256 remained `4a1ef8c86aa38d93fafb49d154c43a9106424a0acf5f8ad7f4a47eafc051af21`, equal to the retained local production build and archived P7 record. No session cookies, private assets, environment secrets or service configuration were copied.
- Current Nginx configuration has `location / { try_files $uri $uri/ /index.html; }` with no separate asset 404 rule, no explicit HTML cache header and no CSP header in the observed HTTPS response. A request for the failed release's absent hashed JS against the restored 0.6.7 site returned **HTTP 200 `text/html`**. The current 0.6.7 entrypoint references `index-ChptqF9V.js`; the failed 0.7.3 entrypoint references `index-DJ9JsKQJ.js`. The HTML was last modified at different times and the JS hash changed. A 401 on `/api/auth/session` is expected for signed-out hosted UI and does not by itself explain an empty root.
- The prior P7 closeout captured no first browser exception, failed module request or cached HTML identity from the actual failed session. The read-only server journal showed the controlled application restart; it could not establish a browser-side cause. The cached-entrypoint explanation remains **a reproduced failure mechanism, not a verified account of the original incident**.

## Browser reproduction and guard

`scripts/staging/smoke-studio.mjs` launches headless Chrome with a fresh profile, serves production `dist` under a same-origin hosted-shaped HTTP server, provides signed-out and fixture signed-in session/project responses, and captures runtime/console errors. It requires visible `#root` sign-in text and a named authenticated project; static 200 responses do not pass. The fixture does not qualify OIDC, existing creator data, or real HTTPS browser behavior.

| Bundle and entrypoint | Result |
| --- | --- |
| Retained 0.7.3 bundle with its own index | Signed-out sign-in and fixture signed-in project **PASS**, zero browser errors. |
| Read-only copy of active 0.6.7 bundle with its own index | Both views **PASS**, zero browser errors. |
| Retained 0.7.3 bundle with active 0.6.7 index | **FAIL**: empty `#root`; Chrome: `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"` for `/assets/index-ChptqF9V.js`. |

`build-release.sh` now requires an absolute path to a read-only copy of the active release's `index.html` plus its adjacent `assets/`. It first checks the new entrypoint, copies only the hashed JS/CSS referenced by the active entrypoint into the candidate after path/size/symlink/collision checks, then verifies the **assembled** bundle with the old entrypoint. The exact old-index/new-assets mismatch fails without those carried assets and passes with them. R4 still requires signed-out and renewed real creator login checks on the actual origin; this local mechanism may not explain every browser failure.

## Validation and native preflight

- `npm run build -w @firelaunch/studio`: **PASS**, 159 modules, original JS hash unchanged; includes Studio typecheck.
- `node --import tsx --test apps/studio/test/auth.test.tsx apps/studio/test/shell.test.tsx`: **6 passed, 0 failed**.
- `node scripts/staging/smoke-studio.mjs`: **PASS** for 0.7.3 production bundle; same command with the copied 0.6.7 `dist`: **PASS**. Prior-index variant: expected **FAIL** with the exact module MIME error above. `node --check scripts/staging/smoke-studio.mjs`, `bash -n scripts/staging/build-release.sh` and `git diff --check` pass.
- `PATH=<npm 12.2.0 binary>:$PATH bash scripts/staging/build-release.sh /tmp/firelaunch-c7-p1-candidate.tar.gz /tmp/firelaunch-067-smoke/dist/index.html`: **PASS**. Both Chrome checks passed against the assembled bundle, runtime workspace imports passed, and the local nondeployed archive SHA-256 is `262dfb9b434c802bf662bed6b01c3d9e0aa08aa3ebff9fddfe98428e1cd124de`. It contains the active 0.6.7 hashed JS alongside the 0.7.3 JS. This is an application candidate archive, not a creator ZIP/VPKG or permission to deploy.
- `vega virtual-device start --gui --gl-accel --timeoutSeconds 30` printed `Virtual device ready`, then `vega virtual-device status` reported `running:false`, QEMU PID `-1`, and `vega device list` reported `No devices found`. No stable serial, graphical held session, install or playback was observed. A stable device serial remains an R4 prerequisite, not an R1 source-work blocker.

R2 needs an independently isolated build worker; this browser guard does not change the existing fail-closed export route. R4 needs operator approval for a protected rollout, a real browser console/root check on the live origin, renewed creator session, and stable VirtualDevice before claiming ZIP/device qualification. A later cache/asset-serving policy change would need separate review. Historical P7 P4, Q2 F7 and Q3 statuses remain unchanged.
