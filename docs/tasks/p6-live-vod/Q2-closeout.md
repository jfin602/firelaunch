# Q2 closeout — FREE release live; overall NOT GREEN

**Latest disposition (2026-10-19 02:34 UTC): F5 GREEN, F6 PASS, F7 PARTIAL; Q2 NOT GREEN.**
The approved synthetic FREE release remains live. Five-cycle evidence below
adds refreshed AWS inventory and an actual staging app-role delivery-write
denial. Real simultaneous A/B browser sessions showed B excluded from A's
project UI, but private API/CSRF HTTP results and an isolated revocation/CDN
cache fixture are still missing. Q3 must remain unstarted. Earlier dated
dispositions below are retained as history.

**Historical first preflight (2026-10-18 19:27 UTC): BLOCKED / NOT GREEN.** The first
preflight below stopped because its checkout lacked Q1 evidence. A subsequent
read-only preflight found the primary Q1 GREEN report in the separate Q1
worktree and the owner-transcribed report on newer `origin/main`. Q1's exact
private rendition is eligible for **Q2 preflight only**. Q2 still has no
operator-approved public CDN or dedicated public-only HTTPS host, no verified
owned deployment/artwork and no creator publication consent. No Q2 public
release or activation occurred. The original first-preflight account is
preserved below; the resumed findings follow it.

Date: 2026-10-18 19:19 UTC
Disposition: **BLOCKED / NOT GREEN**. No public release or CloudFront activation occurred.

## Prerequisite and source

The Q2 prompt requires a documented **Q1 GREEN** result for the exact privately verified READY HLS rendition before Q2 publication work. `docs/tasks/p6-live-vod/Q1-closeout.md` does not exist in this checkout. The 2026-10-18 owner-reported successful encode in `docs/CURRENT-STATE.md` has no attached source-bound Q1 verification of owner, rights, original, managed job, complete private HLS graph, durable READY state, or privacy/access negatives. This is an evidence gap, **not** a claim that no encode or READY record exists.

Read-only repository preflight found `main` at `9361840fdd99e4c266def1d11cab7acc47957e05`, matching `origin/main` by `git ls-remote`. The working tree was clean before this report. Root `package.json` remains `0.6.7`. The current-state document dates the canonical staging service, schema 13, backup and rollback baseline, and client AWS account `363242105231` in `us-east-2`; none was freshly verified on the host or AWS in this Q2 attempt. No creator project, deployment, artwork, media record or published release was selected.

## Qualification matrix

| Gate | Result | Evidence / reason |
| --- | --- | --- |
| F5 — free viewer policy | **BLOCKED / NOT GREEN** | Q1 prerequisite missing. No live distribution/OAC/object inventory, change set, approval, activation, or real CDN/S3 access tests in Q2. |
| F6 — owned release | **BLOCKED / NOT GREEN** | No verified Q1 READY rendition, creator/deployment/public-only HTTPS origin verification, creator consent, immutable publication, or CloudFront HLS graph. Release ID, sequence and SHA-256: **none**. |
| F7 — revocation and isolation | **BLOCKED / NOT GREEN** | No Q2 live foreign-owner, CSRF, unpublished/revoked, invalidation, or cache probes. Existing source and historical tests are not substituted for Q2 evidence. |

## Changes, exposure and approvals

- No CloudFormation change set was created or executed; no AWS distribution, function, OAC, S3 policy, IAM, DNS, Nginx, service, database, media object, manifest pointer, or creator content was changed by this attempt.
- No Q2 operator activation, staging deployment, or creator publication approval was requested or granted in this attempt. Earlier Q1 or documentation approval would not authorize those actions.
- The actual present distribution/service enabled state and current `delivery/` object inventory were **not** rechecked; dated documents last reported CloudFront disabled. Public bytes scope, precise HTTP denial codes, MIME, cache TTL and costs are **unmeasured** here. Q2 incurred no intentional metered media/CDN activity.
- No rollback was needed. Historical releases and media were not modified. The dedicated public-only resolver hostname and its `GET /public/v1/deployments/<deployment-id>/current` and `GET /public/v1/deployments/<deployment-id>/releases/<release-id>` routes were not exercised.

## Verification and handoff

This was a prerequisite stop, not a fix/retest cycle. Focused source/unit/integration tests: **0 run, 0 pass, 0 fail, 0 skip**. Real HTTPS/AWS probes: **0 run**. `npm run check` was not run because no candidate Q2 implementation converged. `git diff --check` passed; a separate whitespace check of this new untracked report produced no diagnostics.

Next action: complete manual Q1 with a real privately verified READY rendition and record F0–F4 as GREEN in `Q1-closeout.md`, including redacted exact source/owner/rights/job/output identity and privacy evidence. Then restart Q2 preflight against current host, AWS and creator records, prepare reviewable exact CDN/public-host changes, and obtain separate operator and creator approvals before any activation or publication. Q3 has **no** qualified deployment ID, approved master URL, v1 release/hash, public origin, or package ID handoff from Q2 and must remain unstarted.

## Resumed read-only Q2 preflight — 2026-10-18 19:23–19:27 UTC

### Q1 evidence and exact candidate

`origin/main` advanced from local `9361840f` to documentation-only `1dbb442d`
while this checkout retained the untracked first Q2 report. The newer commit
adds `Q1-closeout.md`; HEAD was not moved and the working tree was not reset.
The primary report at
`/home/jfin/.codex/worktrees/q1-live-vod/firelaunch/docs/tasks/p6-live-vod/Q1-closeout.md`
independently closes F0–F4 GREEN at 19:15 UTC. It binds one synthetic,
creator-asserted rights-cleared input, real MediaConvert job
`1792298238156-lo2djx`, seven privately rehashed HLS objects and a durable
owned READY rendition. Its project is `ch_21ae…e6a`, catalog item
`ci_726c…d4e`, asset `ma_0093…845`, rendition `rs_1827…e85` and existing
Videos shelf `col_8226…f0c` at position 0. Full identities, hash inventory,
rights and source evidence remain in the primary report. Q1 created no public
delivery object or release. These Q1 facts were read from that report, not
freshly queried from PostgreSQL in this Q2 preflight.

The tested Q1 source is detached HEAD `150fd5b8` plus four uncommitted
source/test changes (patch SHA-256
`ec4c98581aafc237831f00a8b05ddce077ba490275a764c0836ec6bb96544b7b`).
Those fixes are absent from this checkout at `9361840f` and from `origin/main`.
The canonical service still runs the corrected, approved Q1 archive
`20261018T044634Z-0d40285debb2`; any Q2 candidate archive must preserve its
provider-verification fixes and be compared with the deployed source before a
separate deployment approval. Root version remains `0.6.7`.

### Fresh host and AWS reads

- `firelaunch-staging.service` is active at the canonical release above;
  `firelaunch-alpha-067.service` is inactive. The Q1 primary report freshly
  verified schema 13, the prior compatible release
  `20261017T025825Z-59a5a1e6921b`, protected preactivation/predeploy
  encrypted database backups and active HTTPS health. This Q2 read verified
  service/release/version, but did not rehash backup archives or query the
  protected database: the prior command-specific host grant has expired and
  the `deploy` OS account has no PostgreSQL role. S3 media is outside the
  database archives. Ngest was untouched.
- Fresh STS: scoped deployer in account **363242105231**, `us-east-2`.
  Foundation stack `firelaunch-staging-foundation` is `UPDATE_COMPLETE` with
  queue `PAUSED`, event rule `DISABLED`, `DeliveryDistributionEnabled=false`
  and no pending available change set. Distribution **E3E4ESF38V413L** is
  deployed but **disabled**, at `dl2jzii5bnotd.cloudfront.net`, with OAC
  **E3FC82P2MZSJ0K**, one S3 origin and empty `OriginPath`. No alias or WAF is
  configured; the default certificate serves its CloudFront hostname.
- The live viewer-request function `firelaunch-staging-delivery-lock` returns
  **403 for every request**. Trusted key groups are disabled; the current
  template's `EnableSignedDelivery` condition cannot enable the distribution
  with an empty signing key. Merely changing the enable parameter would leave
  it disabled. The current cache policy is Managed-CachingOptimized with
  minimum/default/maximum TTL **1 / 86,400 / 31,536,000 seconds**; there are
  no custom error responses. This is the observed configuration, not an
  approved free-viewer policy.
- Media-bucket public-access block has all four controls enabled. The bucket
  policy allows CloudFront OAC `GetObject` only at
  `media/*/*/*/delivery/*` for this exact distribution ARN. The app policy
  v3 explicitly denies delivery PUT/tag/delete; the publisher policy v2 can
  read staged and mutate delivery, and the publisher role trust names only
  `firelaunch-staging-app`. The deployed service-role and IAM boundary must
  still be exercised with real positive/negative Q2 requests before GREEN.
- A complete list of the current media bucket returned **14 staged objects,
  zero delivery objects**. Thus activating the existing bucket now would not
  expose any *present* delivery bytes, but an exact canonical free path guard
  and publisher approval boundary are required before activation. This is
  not proof of future object safety or enabled-CDN access denial.
- Fresh unsigned direct S3 HEAD of an actual original and an actual staged
  master each returned **403**. The disabled CloudFront hostname did not
  resolve in the external probe (`curl` status 000); no enabled-CDN 403/200,
  wrong-host, traversal, MIME or full graph test has been claimed.
- The current Nginx `firelaunch-staging` vhost serves only
  `firelaunch.jfin.dev` and proxies `/api/` to `127.0.0.1:4184`; all other
  paths fall through to its Studio SPA. A bogus `/public/v1/deployments/...`
  request there returned **200 SPA HTML**, so that host is unsuitable for the
  TV resolver. No dedicated public-only vhost was found. Proposed
  `tv.firelaunch.jfin.dev` currently has **no DNS answer**. Its name is a
  review proposal, not an approved creator package origin.

### Review-only change and approval boundary

No CloudFormation change set was created or executed and no template/source,
DNS, Nginx, IAM, service, object or database state was changed. A safe free
path needs a separately reviewed **UPDATE** of the existing Foundation stack:
add a free-delivery condition and canonical viewer-request path function
(including exact delivery-key grammar, GET/HEAD, query/path/host rejection).
For this one-video gate, the function must allow only the Q1 rendition's
exact owner/project/asset/rendition/master-hash prefix and verified HLS file
names; a syntactically valid *other* delivery key must remain denied. The
approved prefix must come from the fresh protected rendition record, not
caller input. A reviewed template parameter can carry this exact prefix.
Retain the existing blanket lock for disabled mode, and modify only this
distribution's enabled condition, viewer-function association and description.
No new signing key, key group, public S3 permission, origin path, account or
distribution is proposed. The **expected** resource inventory is one added
CloudFront Function and one modified existing distribution, with no IAM/S3
policy change, removal or replacement. This is a design inventory, **not an
actual change-set inventory**. A real created change set must be inspected
for add/modify/remove/replacement and cost before a distinct execution
approval; any extra permission class or replacement stops this plan.

Separately, the proposed public-only `tv.firelaunch.jfin.dev` would need an
approved IPv4 DNS record to the current host (`87.106.146.255` as resolved
for `firelaunch.jfin.dev` in this preflight), a valid dedicated TLS certificate
and an Nginx vhost that proxies only the two exact GET routes under
`/public/v1/deployments/` to loopback `127.0.0.1:4184`, stripping cookies and
credentials and returning 404 for `/api`, Studio, private paths and all
other methods. The existing Studio vhost must remain unchanged. DNS, TLS,
Nginx and service operations need separate host/operator approval and a
reviewed rollback. The Q1 owner project, deployment/package identity, its
artwork license and current source/catalog/channel revisions have **not**
been freshly read from the protected database or authenticated Studio. The
Q1 video-rights claim is **not** creator consent to a public FREE release.

The narrow source repair, if current records confirm it is needed, is the
owned READY managed-HLS → server-derived stable CDN URL binding for one
video on the existing Videos shelf. `catalog-projection.ts` currently accepts
only public HTTPS media and excludes `managed_hls`, while publication resolves
the exact verified rendition. The draft must receive its real reviewed URL
with revision CAS and preserve creator edits; no placeholder or private URL
may be inserted. No placement UI or new publication shortcut is authorized.

Expected new metered usage after an approved release includes seven S3
delivery COPY/PUT objects and storage, S3 origin GETs, CloudFront viewer
requests and data transfer, CloudFront Function invocations and any
invalidation. Pricing depends on actual traffic, edge region and account
pricing plan; the $20 monthly AWS Budget noted in Q1 is an alert, not a hard
cap. Q2 made only read-only inventory/HEAD requests and did not intentionally
start delivery or a paid MediaConvert job. [AWS CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)
and [AWS S3 pricing](https://aws.amazon.com/s3/pricing/) govern the cost
estimate to review at activation.

Planned enabled-state probes (not yet run): anonymous HTTPS `GET` and `HEAD`
for the exact seven approved `.../delivery/<rendition>/<master-sha>/` objects
must return expected bytes, hashes and HLS/TS MIME; direct anonymous S3 for
those same keys and the real original/staged keys must remain 403. CDN
requests for `/original/`, `/staged/`, a different canonical delivery
rendition, a foreign owner path, wrong host, query, doubled slash, `..`,
encoded traversal, wrong filename, wrong method and a revoked/disposable
fixture must be denied. The public-only TV host must serve only the two
deployment GET routes, with `/api`, Studio paths, foreign/unpublished IDs,
mutations and malformed URLs denied. Authenticated private API probes must
deny a second account, spoofed owner and missing/wrong CSRF. This matrix is
planned acceptance testing, not observed Q2 proof.

### F5–F7 result and handoff

| Gate | Resumed result | Exact remaining proof |
| --- | --- | --- |
| F5 free viewer policy | **BLOCKED / NOT GREEN** | Actual operator-approved UPDATE change set, canonical free path guard and distribution activation, real OAC/S3/CDN negative/positive access tests, cost authorization. Current function denies all and distribution is disabled. |
| F6 owned release | **BLOCKED / NOT GREEN** | Fresh owned deployment, valid public-only TLS origin, artwork rights, exact draft/revisions and free policy, explicit creator readiness → approval → publish, release ID/sequence/SHA-256 and complete public HLS graph. None exists from Q2. |
| F7 revocation/isolation | **BLOCKED / NOT GREEN** | Real foreign owner/CSRF, spoofed owner, malformed URL, stale/processing/revoked/unknown-policy and bounded invalidation/cache tests on a disposable approved fixture. No live Q2 result yet. |

Q2 automated tests: **0 run / 0 pass / 0 fail / 0 skip**; this was read-only
preflight, with no fix/retest cycle or final `npm run check`. Five external
HTTP/DNS probes were made: original S3 403, staged S3 403, disabled CDN DNS
failure, Studio public-path SPA 200 and proposed TV host DNS failure. These
are observations, not F5–F7 qualification. No rollback was needed. The
distribution remains **disabled**; the canonical staging service remains
**enabled**. No manifest was published, so release ID/sequence/digest and
Q3 deployment/master/origin/package handoff are **none**. Q3 must not start.

Next: obtain a fresh protected read-only creator/deployment/artwork/revision
inventory, then review the exact source/CloudFormation/host candidate and
its actual change set. Request **separate** approvals for change-set
execution, distribution enablement, DNS/TLS/Nginx/service changes, deployment
of a precise candidate archive and creator FREE publication. Approval of Q1
or these documents covers none of those actions.

## 2026-10-18 19:34 UTC onward: authorized live continuation (in progress)

The owner subsequently instructed this agent to use developer access, turn on
what Q2 needs and complete the test, granting full Q2 authority. The owner
separately confirmed the exact `tv.firelaunch.jfin.dev` DNS-only A record in
Cloudflare's browser confirmation flow and personally ran the two protected
VPS administrator commands recorded below. This section supersedes the
earlier **current-state** wording above; that wording remains as a dated
record of the pre-approval attempts. Q2 is **not yet GREEN** at this point.

- The exact approved fixture is Q1 owner `386ad586fba749ea979ce5e39c882246`,
  project `ch_21ae035aa31743b1a8a98f145ee34f6a`, item
  `ci_726c83b05cba4325a04acd9a0d6c1d4e`, asset
  `ma_00931342d7ac4dd6b6273d4458c61845`, rendition
  `rs_1827d55a2f9a9390e96b3f3f8c1e6d85`, master SHA-256
  `7874303d9ceabcf880f5086d9a995b5ff010dd8c05fdc4424a5ab08842829494`.
  The verified staged graph is exactly `master.m3u8`, `v480.m3u8`,
  `v720.m3u8`, `v480-000.ts`, `v480-001.ts`, `v720-000.ts`,
  `v720-001.ts`. The delivery prefix had no objects before activation.
- The owner authorized AWS account `363242105231`, region `us-east-2`.
  CloudFormation change set `q2-free-vod-20261018b` previewed only
  **Add** `FreeDeliveryPathFunction` and **Modify**
  `DeliveryDistribution`, with `Replacement=False` and no IAM/S3 policy,
  bucket or origin change. It executed successfully. Foundation stack is
  `UPDATE_COMPLETE`; CloudFront distribution `E3E4ESF38V413L` is enabled
  and `Deployed`, associating the exact free viewer function. The function
  admits only GET/HEAD, its own CloudFront host, no query, this exact
  immutable rendition prefix and the seven named files. It rejects all
  other requests with 403. S3 Block Public Access and OAC-only delivery
  bucket policy remain in place. Queue remains PAUSED and EventBridge
  DISABLED; no new MediaConvert job was submitted.
- Cloudflare `jfin.dev` now has DNS-only A record
  `tv.firelaunch.jfin.dev → 87.106.146.255` (public DNS readback confirmed).
  The first release archive SHA-256 was
  `ae677c7be795a00fd3dc188db879489fd917e32c51cbf9651bd912639ee74032`.
  Its protected deployment activated the sole
  `/srv/firelaunch/releases/20261018T194542Z-ae677c7be795` at schema
  13→13. The protected helper verified encrypted predeploy backup
  `/var/backups/firelaunch-staging/20261018T194542Z-ae677c7be795-pre-deploy-schema-13.flrec`
  (SHA-256 `fd60a200916d83bc59a014cf7850a957e74dc73db96b100bfb1d78a51fdc29e5`).
  No duplicate service or unrelated workload was touched. The owner
  installed the reviewed Q2 origin script as root-owned and executed it.
  Certbot issued a `tv.firelaunch.jfin.dev` certificate expiring
  2027-01-16; Nginx config tests passed. The script's immediate local curl
  reported a certificate mismatch, but an independent external HTTPS
  probe subsequently verified CN, issuer and chain for the TV hostname.
  The public TV origin gives 404 for `/` and `/api/health`, and 404 for an
  unpublished well-formed deployment current path; Studio `/api/health`
  still returns authenticated 401. The synthetic poster
  `https://firelaunch.jfin.dev/q2/q1-owned-synthetic-video.png`
  returns public `200 image/png`, 86,504 bytes. It was created for this
  owner-approved Q1 synthetic test, with no private artwork exposed.
- Nine real CloudFront negative probes returned 403: staged, original,
  different rendition, wrong filename, query, doubled slash, encoded
  traversal, `/api/health` and wrong Host. An exact approved path still
  resolves to missing S3 bytes until creator publication; no CDN positive
  claim is made yet. Anonymous S3 original/staged denial from earlier
  preflight remains valid; direct delivery denial must be retested after
  promotion. AWS `cloudfront:TestFunction` is not available to this
  deployer role, so positive viewer behavior must be proven with live HTTPS.
- Authenticated Google Studio session under the Q1 owner selected the
  Q1 video in its existing one-item Videos collection. The new public
  artwork form attached the synthetic poster with creator-asserted TV
  display rights. The first attempted draft Generate failed closed with
  `No selected licensed playable media is ready`, because the Q1 managed
  asset's `deliveryEligible` bit remained false. A focused Studio fix adds
  an explicit creator review control that requires verified READY upload
  and both cleared TV rights before setting that bit. It still does not
  publish content. The replacement archive
  `firelaunch-q2-delivery-review-0.6.7.tar.gz`, SHA-256
  `597ccc492b0f7eeb3357f189219a5ec83d95578a8df0526620aa39bf9f52c54d`,
  was deployed by the owner at
  `/srv/firelaunch/releases/20261018T195042Z-597ccc492b0f`, schema
  13→13, after encrypted backup
  `/var/backups/firelaunch-staging/20261018T195042Z-597ccc492b0f-pre-deploy-schema-13.flrec`
  (SHA-256 `35a8b0d0e6a52d46967a9bc942c4a7f46b601f69013b365512f1da8cc7934adf`).
  DB inspection then confirmed the Q1 asset is `deliveryEligible=true`,
  upload `verified` and processing `ready`, but the browser still excluded
  it from Generate. The Catalog and Publish screens fetched all managed
  video states as one fail-all batch. Both now retain successful individual
  status reads if an older unrelated upload fails. The corrected final
  archive SHA-256 is
  `b6d56a0701795a99b5ae4fcef50ecc8769dfe96dc612f123f690567ce9a659da`;
  the VPS incoming archive and required `.sha256` sidecar verify. Its
  protected deployment is pending. An earlier attempt to deploy this
  archive failed before mutation because the sidecar was missing; the
  sidecar is now present. No backup or release switch occurred on that
  failed invocation.
- Local focused results: server and Studio typechecks and builds passed;
  media/storage focused tests 16 passed, 2 DB-gated skipped; the two
  DB-gated suites plus publication integration passed separately against
  the isolated local PostgreSQL (3 passed, 0 failed); Studio suite 39
  passed, 1 failed on an existing Studio canyon-theme CSS expectation
  unrelated to Q2. `git diff --check` passed. No commit, HEAD movement or
  root version change occurred.

Pending: install the verified final release, generate the exact
Videos draft, create its owned deployment on the dedicated HTTPS origin,
perform readiness→approve→publish, then prove the public manifest and
complete CloudFront HLS graph plus owner/CSRF/revocation/cache denials.
F5 is **PARTIAL**, F6 and F7 remain **NOT GREEN** until these direct
results exist. Q3 must not start.

## 2026-10-18 20:12 UTC: live FREE release and external verification

The continuation completed the owner-authorized release. The dated pending
paragraph above is superseded by the observations here.

- The final source-review deployment at
  `/srv/firelaunch/releases/20261018T200727Z-d3063337ccc5` passed schema
  13→13 and verified encrypted backup
  `/var/backups/firelaunch-staging/20261018T200727Z-d3063337ccc5-pre-deploy-schema-13.flrec`
  (backup SHA-256
  `5ac192103e7c8e7a74e3d6be54567327f7be69ff2cdb565022b6d28018ef004e`).
  The server change was present, but the release had accidentally packaged
  the prior Studio bundle. The rebuilt archive SHA-256
  `4e4fde123451e75a8f5f211fe3a0805455a545adc9936d273d03209629b18d09`
  includes `index-BwkP-UBM.js`; host checksum and contents were independently
  checked before the owner ran the protected helper. It activated
  `/srv/firelaunch/releases/20261018T201026Z-4e4fde123451`, schema 13→13,
  after verified encrypted backup
  `/var/backups/firelaunch-staging/20261018T201026Z-4e4fde123451-pre-deploy-schema-13.flrec`
  (backup SHA-256
  `59b2cd4f60d8ee82dcd589382b0e2177a8c5b211654062778522103087c80ee3`).
  The earlier archive caused no publication or media mutation.
- In authenticated Studio, the Q1 source review attached a private 2,851-byte
  provenance PDF (local SHA-256
  `09d439d6ed493c0773041a7eef4cd19b520f2a7c5487def4a4c4a645809c46e1`)
  and asserted creator-upload retrieval and TV display permission. Studio
  returned “Creator-upload source verified with private provenance evidence.”
  This shared-source verification did not approve either unrelated draft item;
  each still lacks READY managed HLS.
- The existing ChannelSpec draft revision 8 and catalog revision 14 bound
  only item `ci_726c83b05cba4325a04acd9a0d6c1d4e`, public poster asset
  `ma_a6de62f10ab5488e9925ecb52d88e636` and verified READY video asset
  `ma_00931342d7ac4dd6b6273d4458c61845`. The owner deployment is
  `dep_00e792ad15a14aa1be420d6721956192`, package
  `com.jfin.snabbletv`, manifest origin
  `https://tv.firelaunch.jfin.dev/`. Studio readiness returned
  “Draft approved, not live”; immediately before the browser's final
  Publish action, the owner explicitly confirmed this exact public FREE
  release and its seven CloudFront files. The browser confirmation dialog
  was accepted. No native package or Amazon submission was performed.
- Studio and the anonymous public resolver independently show **LIVE release
  #1** `rel_99483e7fc9f0438c858b90c5db77d06c`, published
  `2026-10-18T20:12:09.583Z`. The current pointer gives deployment ID,
  sequence 1 and SHA-256
  `b7336f0807a49232be2b5575cbaf94808db45afe57b37b663f1b6473f5d09426`.
  The immutable release endpoint returned 200, 3,453 bytes, exact matching
  raw-body SHA-256 and ETag, `Cache-Control: public, max-age=60, immutable`;
  matching `If-None-Match` returned 304. The current pointer uses
  `max-age=0, must-revalidate`. The manifest contains only the one approved
  video and public poster, stable CloudFront URL, schema 1, package ID and
  no private S3 key, signed URL, token or evidence URI.
- Anonymous external CloudFront GET fetched all seven HLS files with 200.
  Every byte count and SHA-256 matched the Q1 private table exactly: master
  156, variants 187 each, segments 1,175,564 / 1,082,316 / 2,395,872 /
  2,143,764 bytes. Playlists used relative same-prefix references only;
  MIME was `application/vnd.apple.mpegurl` for playlists and `video/mp2t`
  for segments, with `Cache-Control: public, max-age=60`. Exact master HEAD
  returned 200. No Vega device playback is claimed.
- Postpublication CloudFront negatives returned 403 for query, original,
  staged, foreign owner, other rendition, unapproved filename, doubled slash,
  raw parent segment, encoded traversal, POST and wrong Host. Direct
  anonymous regional S3 GET of the exact delivery master returned 403;
  a staged-path probe also returned 403. These are external HTTP results,
  distinct from earlier AWS policy inspection.
- The TV-only hostname returned 404 for `/`, `/index.html`, `/api/health`,
  `/api/projects`, unknown deployment, unknown release, malformed release
  path, POST on both public routes and HEAD on current. Anonymous Studio
  owner-project, catalog, deployment and release API reads each returned
  401. A second real Google account (`j4c0bsw4p@gmail.com`) had no projects;
  forcing the owner's project query in Studio returned to its empty home.
  Direct authenticated foreign API and live wrong-CSRF probes remain to be
  measured; they must not be inferred from the UI redirect.
- A final `npm run check` passed all workspace typechecks and build and the
  kernel tests, then failed in Studio on the pre-existing canyon-theme CSS
  expectation (`--fl-canyon-image`); this test is outside Q2 changes. The
  earlier focused Q2 suites and isolated PostgreSQL integration passed as
  listed above. The postpublication AWS CLI credential expired; an attempted
  AWS session refresh initially reached an AWS sign-in error. AWS direct
  readback after publication remains pending while external HTTPS checks
  verify the active path. No further MediaConvert job, queue activation,
  EventBridge enablement, native build or Q3 run occurred.

The fixture's pre-Q2 catalog description still says “private encoding
qualification only; no publication.” That metadata text is stale after this
authorized synthetic publication. The manifest's release metadata and pointer
correctly report the live state; the description should be corrected in a
separate creator edit/release if this fixture is retained for viewers.

## Final bounded matrix and handoff

| Gate | Result | Direct evidence and remaining gap |
| --- | --- | --- |
| F5 — FREE viewer policy | **NOT GREEN** | Exact live public GET/HEAD and 11 CDN 403 negatives, direct S3 delivery 403, preactivation AWS policy/change-set inspection. Fresh postpublication AWS role, bucket, seven-key inventory and app-role denial readback still require CLI access. |
| F6 — owned immutable release | **GREEN for Q2** | Real creator readiness→approval→confirmation→publish; release #1 and exact raw-body SHA/ETag; one approved video/poster; seven exact Q1 HLS hashes/MIME over external HTTPS; public-only TLS resolver and negative routes. No native playback or Appstore claim. |
| F7 — revocation/isolation | **NOT GREEN** | Anonymous private APIs 401 and second real Google account had no access to the owner's Studio project. Isolated PostgreSQL and kernel tests cover foreign, CSRF, revocation and invalidation, but direct live authenticated foreign API/wrong-CSRF responses and a disposable live revocation/cache observation remain unmeasured. |

The current exact public release is available for Q3 planning, but the Q3
execution gate is not met: owner project
`ch_21ae035aa31743b1a8a98f145ee34f6a`, deployment
`dep_00e792ad15a14aa1be420d6721956192`, package
`com.jfin.snabbletv`, public origin `https://tv.firelaunch.jfin.dev/`,
release `rel_99483e7fc9f0438c858b90c5db77d06c` sequence 1 SHA-256
`b7336f0807a49232be2b5575cbaf94808db45afe57b37b663f1b6473f5d09426`,
approved master
`https://dl2jzii5bnotd.cloudfront.net/media/386ad586fba749ea979ce5e39c882246/21ae035aa31743b1a8a98f145ee34f6a/00931342d7ac4dd6b6273d4458c61845/delivery/1827d55a2f9a9390e96b3f3f8c1e6d85/7874303d9ceabcf880f5086d9a995b5ff010dd8c05fdc4424a5ab08842829494/master.m3u8`.
CloudFront and the sole canonical staging service were left **enabled**;
MediaConvert queue and EventBridge remained paused/disabled. No live release,
object or backup was rolled back.

Final local check: all workspace typechecks and build passed; kernel
**127 passed / 0 failed / 15 skipped**. The aggregate `npm run check` stopped
in Studio with **39 passed / 1 failed** on the pre-existing canyon CSS
expectation. The earlier focused Q2 media/storage suite had **16 passed /
0 failed / 2 skipped**, and three isolated PostgreSQL integration tests
passed. `git diff --check` passed. Root version stayed 0.6.7; no commit,
HEAD rewrite or Q3 run occurred.

## Final qualification recovery — 2026-10-19 01:25–01:28 UTC

**A. Disposition: Q2 NOT GREEN.** F6 remains PASS for the already published
synthetic FREE release. F5 and F7 remain PARTIAL; no observed access failure
was found in this pass, but their required live proof is incomplete. This
section preserves every earlier dated Q2 result above. Q3 execution remains
gated; this pass did not start it.

**B. Exact source.** The inspected local `main` was clean at
`d703ccd21690953b95e191435c753fe7cd222152`, root version `0.6.7`.
It includes the Q2 implementation and the four Q1 repair files. The four
current Q1 file SHA-256 values exactly matched their separate, still-dirty
Q1 worktree counterparts; the primary Q1 report and its historical verdict
were not changed. The public deployment is the previously approved
`/srv/firelaunch/releases/20261018T201026Z-4e4fde123451`, archive SHA-256
`4e4fde123451e75a8f5f211fe3a0805455a545adc9936d273d03209629b18d09`
as recorded above; the host archive was **not freshly rehashed** here. This
recovery edit changes documentation only. Its qualification-section
fingerprint is recorded after the section below.

**C–D. Existing creator approval and Q1 media.** The earlier authenticated
Studio consent approved the synthetic FREE item
`ci_726c83b05cba4325a04acd9a0d6c1d4e`, READY asset
`ma_00931342d7ac4dd6b6273d4458c61845`, rendition
`rs_1827d55a2f9a9390e96b3f3f8c1e6d85`, public poster
`ma_a6de62f10ab5488e9925ecb52d88e636`, and existing Videos shelf.
The primary Q1 report binds MediaConvert job `1792298238156-lo2djx` to its
privately verified READY HLS. The seven named files and exact Q1 hashes are
in the previous section and primary Q1 report. This pass fetched only the
master, not the seven files again. No upload, encode, promotion, publication,
revocation, or deployment was performed.

**E. AWS identity and configuration.** The existing local profiles include
`firelaunch-deployer`; the other read-only portal profile could not be
identified by role from profile names/configuration alone. STS for
`firelaunch-deployer`, `firelaunch-client-jfin`,
`firelaunch-developer-jfin`, and `FireLaunch-Staging-Deployer` each returned
`ExpiredToken`, including a repeat deployer check. No credential value was
shown, copied, replaced, or refreshed. Therefore this pass has **no fresh
assumed-role identity**, stack, distribution/OAC/origin, bucket policy,
queue/rule, seven-key S3 inventory, IAM, budget, or billing observation.
The last verified AWS state in the earlier Q2 section was Foundation
`UPDATE_COMPLETE`, distribution `E3E4ESF38V413L` enabled/Deployed with OAC
`E3FC82P2MZSJ0K`, queue PAUSED, and EventBridge DISABLED. Treat those as
dated observations until scoped sessions are refreshed and checked.

**F. CDN, OAC, and S3.** This pass independently fetched the approved master
over anonymous CloudFront HTTPS: 200, `application/vnd.apple.mpegurl`, 156
bytes, SHA-256
`7874303d9ceabcf880f5086d9a995b5ff010dd8c05fdc4424a5ab08842829494`,
matching Q1. Fresh CDN staged-path and unapproved-filename probes returned
403. The previous source-bound Q2 checks already established all seven
CloudFront object hashes/MIME, direct anonymous original/staged/delivery S3
403, and canonical/foreign/malformed CDN-path 403. Those seven downloads
and S3 denials were **reused**, not repeated. OAC-only S3 policy and exact
origin path have only the earlier deployment readback; postpublication AWS
configuration and a real app-principal delivery-write denial remain missing.
No mutating S3 permission probe was attempted without an approved disposable
target. Publisher use is evidenced by the existing successful seven-object
promotion and source-bound role separation, but no fresh role policy/trust
readback was possible.

**G. Manifest and publication.** Fresh anonymous GET of the canonical
`/public/v1/deployments/dep_00e792ad15a14aa1be420d6721956192/current`
returned release `rel_99483e7fc9f0438c858b90c5db77d06c`, sequence 1 and
SHA-256 `b7336f0807a49232be2b5575cbaf94808db45afe57b37b663f1b6473f5d09426`.
The canonical immutable `/releases/rel_99483e7fc9f0438c858b90c5db77d06c`
returned 200, 3,453 bytes, with an identical raw-body SHA-256 and ETag.
Pointer ETag matched its own raw-body SHA-256
`d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059`.
Pointer cache control is `max-age=0, must-revalidate`; immutable release
cache control is `max-age=60, immutable`. The body binds the owned catalog
item to the READY video and public poster, package `com.jfin.snabbletv`,
project `ch_21ae035aa31743b1a8a98f145ee34f6a`, and deployment above.
The public JSON contains no S3 URL, signed capability, access-key marker,
evidence URI, or AWS account number. The current pointer remains #1; this
pass created no additional release. An authenticated full-history listing
was not performed.

**H. Isolation and revocation.** Fresh public-only TV-host probes returned
404 for `/api/health` and an unknown deployment; anonymous Studio
`/api/projects` returned 401. The previous Q2 evidence includes a second
real Google account's Studio denial, local two-principal/CSRF/revoked media
tests, and invalidation/cache behavior. Those are partial F7 evidence, not
direct authenticated foreign-account API or wrong-CSRF live responses.
There was no available authenticated two-account session or separately
approved disposable fixture for a live draft/unready/revoked publication
and bounded CDN invalidation/cache test. The active release and unrelated
creator media were left intact. Revoked content may persist in CDN cache or
offline clients within documented limits; no instantaneous erasure is
claimed. Ngest was untouched; its current health was not freshly tested.

**I. Cost and exposure.** The same seven approved FREE HLS objects and one
public manifest remain reachable. CloudFront, S3 storage/requests, the
viewer function, and possible invalidation remain usage-billed. Q1's
reported $20/month budget is an alert, not a charge cap; posted charges and
current budget were not readable with expired sessions. This pass made only
bounded read-only HTTPS/STS calls and incurred no new MediaConvert job or
publication.

**J. Final gate ledger.**

| Gate | Result | Remaining acceptance proof |
| --- | --- | --- |
| F5 FREE viewer policy | **PARTIAL** | Fresh intended-account/deployer and independent read-only STS; deployed stack/distribution/OAC/origin/bucket/IAM/queue/rule readback; real app-role delivery mutation denial on an approved disposable target. Existing CDN/S3 positive and negative HTTP evidence remains valid for the tested objects and paths. |
| F6 owned immutable release | **PASS** | Existing creator approval, exact READY rendition and seven Q1-matching public files, public-only resolver, release #1/pointer integrity, rights-cleared poster and one Videos binding are source-bound and freshly spot-checked. No native-device claim. |
| F7 revocation and isolation | **PARTIAL** | Direct authenticated foreign-owner/project and wrong-CSRF API responses, plus isolated live unready/revoked publication/resolution and bounded CDN revocation/cache behavior, require authenticated sessions and an approved disposable fixture. |

**K. Validation.** This recovery pass ran **0 automated tests: 0 passed,
0 failed, 0 skipped**; no source changed, and it did not repeat `npm run check`.
It made 3 positive anonymous HTTPS GETs (pointer, release, master), 5
negative HTTPS GETs (2 CDN 403, 2 TV-host 404, 1 Studio 401), and 5
expired-token STS attempts (four profiles plus deployer repeat). Existing
Q2 results were reused: seven CloudFront hash matches; focused media/storage
**16 passed / 0 failed / 2 skipped**, isolated PostgreSQL integration **3
passed / 0 failed**, kernel **127 passed / 0 failed / 15 skipped**, Studio
**39 passed / 1 failed** on the pre-existing canyon CSS expectation. That
aggregate was **not a full PASS**. Current `git diff --check` is recorded
after this section below.

**L. Smallest resolution.** Refresh existing temporary scoped portal
sessions, identify the read-only profile by verified STS role, and perform
bounded postpublication AWS readback. Use an expressly approved disposable
S3 target for a real negative write test. Provide authenticated owner and
second-account sessions plus a separate disposable video/deployment to
exercise live foreign/CSRF/unready/revoked/cache paths. Do not touch or
republish release #1 to obtain proof. If those checks pass, append their
source-bound results and reassess F5/F7; no new job or release is otherwise
needed.

**M. Exact Q3 handoff status.** The existing deployment, public origin,
release #1, digest, existing Videos shelf, poster and CloudFront master above
can support Q3 planning, but **Q3 may not officially execute until Q2 is
GREEN**. Q3 separately owns the real creator-bound Vega VPKG, adaptive HLS
play/pause/seek/Back, same-installed-package refresh, offline LKG, and
rights-checked new-sequence rollback. No Q3 test was run here.

**Working-tree fingerprint:** before this documentation edit, `main` was
clean. After it, the only changed path is this `Q2-closeout.md`. The SHA-256
of the recovery section starting at its heading and ending immediately above
this fingerprint paragraph is
`5c910b31e9615b7e02ed8d6a2eb351bdcd2ba7626c432f5742ba676a5f1d05fd`.
`git diff --check` passed (exit 0). The source files and root version are
unchanged; no commit was made.

## Q2 five-cycle qualification update — 2026-10-19 02:34 UTC

The five-cycle record is in [qualification/q2-five-cycle](qualification/q2-five-cycle). Cycle 1 **PASS**: refreshed scoped STS verified the human deployer and a distinct read-only role in account `363242105231`; read-only inspection confirmed the enabled/deployed distribution, exact seven-file viewer allowlist, OAC/private buckets, role policies, paused encode queue, disabled processing rule and $20 alert budget. Stack drift remains `NOT_CHECKED`; no drift scan or resource change was made. Cycle 2 **PASS**: one real staging app-role attempt to write a synthetic canonical delivery key returned explicit identity-policy `AccessDenied`, and the object remained absent. This closes the bounded F5 access gap without changing release #1.

Cycle 3 **PARTIAL**: A and B were simultaneously signed in with separate real Google identities in the in-app browser and Chrome. B's attempt to open A's exact Studio project URL returned B to its empty new-channel screen; A remained on the owned project and the release #1 metadata was unchanged in the UI. Direct private API navigation in both browser surfaces was blocked by the browser client before an HTTP response, so no foreign authenticated API status, denied write, private capability or wrong-CSRF result is claimed. Anonymous TV resolver 200/private Studio API 401 and TV-host 404 observations remain only the public boundary proof. Cycle 4 **BLOCKED**: the owner confirmed no eligible disposable, creator-owned rights-approved second video fixture exists. The live revocation, stale-publication and CloudFront invalidation/cache test therefore did not run. The single-prefix viewer allowlist would also need a reviewed change to serve a second fixture; release #1 was not used as a revocation subject.

Cycle 5 **PARTIAL**: the prior Studio failure was a stale test expectation after committed CSS switched to the shipped `desert-canyon.webp` asset. Only the Studio test was corrected to assert that URL and a valid RIFF/WEBP file header; CSS and the image were unchanged. The focused test passed **5/5**. Exactly one final `npm run check` under Node `v24.21.0` and npm `12.2.0` passed all seven workspace typechecks/builds and **271 tests passed / 0 failed / 15 environment-gated skips** (kernel 127/15 skip, Studio 40, runner 104). `git diff --check` passed. Local HEAD remains `3eba83ffbe71646cd0e5b46a95d9b0f06707f264`, root version `0.6.7`; the sole test-source edit has Git blob `298a5b937ebe6a88f65b109841bc7977e30a6817`. It was not deployed. Prior live observations remain bound to the deployed staging archive recorded above, not to the local test edit.

| Gate | Final result | Remaining dependency |
| --- | --- | --- |
| F5 bounded FREE viewer policy | **PASS / GREEN** | None for the already approved release #1 scope. |
| F6 owned immutable release | **PASS** | Existing creator approval, release #1 digest, seven CloudFront HLS hashes, Videos binding and public-only resolver evidence retained; no republish or HLS redownload. |
| F7 revocation and isolation | **PARTIAL / NOT GREEN** | Real authenticated foreign/private API and wrong-CSRF response classes with unchanged-state readback; separate eligible rights-approved fixture and bounded live revocation/CDN invalidation/cache observations. |

**Q2 remains NOT GREEN.** The active FREE release #1, its manifest pointer and seven objects, creator data, backups, service and AWS resources were preserved. No additional encode, public publication, VPKG build or Q3 work occurred. The next Q2 action is to obtain a supported private-API test path for the two existing sessions and an independently approved disposable media fixture; do not treat the aggregate pass as F7 live proof.

## Final Q2 qualification request — 2026-10-19 17:42 UTC

**Disposition: Q2 NOT GREEN; Q3 unstarted.** This request authorized targeted qualification and repair, with at most three cycles. The earlier five-cycle and R1–R3 observations remain dated evidence. This pass made one read-only live preflight and one local validation pass; no additional repair cycle, staging deployment, AWS write, upload, encode, publication, revocation or invalidation was performed. The needed media rights/spend/publication/revocation authorization and authenticated request inspector were requested and were still pending when this record was written.

Exact local source: clean `main` HEAD `b9d251fb794c67d1e8a287936be4f22af557608a`, root version `0.6.7`. The bounded owner-scoped `POST /api/projects/<project>/media-uploads/revoke` repair from `6bbe8bb` is present in this source, but the running staging archive predates it. Fresh read-only host inspection found the single `firelaunch-staging.service` active, retired `firelaunch-alpha-067.service` inactive, and `/srv/firelaunch/current` still pointing to `/srv/firelaunch/releases/20261018T201026Z-4e4fde123451` at version `0.6.7`. The local built `api.js` and `media-upload-service.js` hashes differ from that running archive, so the new route has **no live qualification**. The existing database, releases and media were not changed.

The dedicated HTTPS public pointer freshly returned 200 with release `rel_99483e7fc9f0438c858b90c5db77d06c`, sequence 1, manifest SHA-256 `b7336f0807a49232be2b5575cbaf94808db45afe57b37b663f1b6473f5d09426` and pointer-body SHA-256 `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059`, matching prior evidence. The first HTTPS attempt had a transient connection reset; an HTTP/1.1 retry returned 200. This is a public-pointer health observation, not a new complete HLS or private-database test. The attached Chrome Studio tab showed a signed-out session, and the browser interface offered no authenticated same-origin response inspector. Earlier A/B owner-reported GET results retain their stated full-project-ID parity limit; no new foreign authenticated request or CSRF mutation was sent.

Local validation on the current source: server typecheck PASS, server build PASS, focused `media-upload-service.test.ts` **6 passed / 0 failed / 0 skipped**, full `npm run check` exit **0** (all workspace typechecks/builds and suites passed), and `git diff --check` PASS. A direct `node --test` invocation failed to resolve a TypeScript `.js` import because it omitted this repository's `--import tsx` loader; rerunning that focused test with the repository's configured loader passed. The full-check output was truncated in the terminal capture, so this pass does not assert an exact aggregate test count. These local results do not replace F7 live proof.

| Gate | Current disposition | Basis |
| --- | --- | --- |
| F1–F4 | **PASS carried from Q1** | Original owner-reported, source-bound private processing record; no new job or private HLS qualification in this pass. |
| F5 | **PASS carried forward** | Five-cycle live policy and app-role denial evidence for the approved release #1; no new policy or viewer-path change. |
| F6 | **PASS carried forward** | Approved immutable release #1 and exact seven-file HLS graph from prior Q2 checks; pointer identity freshly matched. No device playback claim. |
| F7 | **PARTIAL / NOT GREEN** | No direct new A/B authenticated foreign mutation/capability response, missing/invalid CSRF response with unchanged owner state, or separate live revoked-media and CDN invalidation/cache observation. Local revocation repair is not deployed. |

The disposable original `/tmp/firelaunch-f7-disposable-20261019.mp4` remains a local 6-second generated test pattern (SHA-256 `69f46ab6babe8851ff02f9a2432d111a115cf3eb579294e6e27a88da543e0f22`), with no approved rights assertion or MediaConvert/publication/revocation grant recorded in this pass. No inference of creator ownership or public eligibility is made from its generated provenance alone. The shortest completion path is to establish supported same-origin HTTP capture for two real Google sessions, run the R1/R2 disposable-draft matrix, then obtain precise approval for this test video's one-job, separate public-release and revocation/invalidation sequence. Deploy the already-tested revocation route through the protected staging workflow only when that live sequence is ready, preserving release #1 and its rollback source. Reassess F7 and Q2 from the actual responses and cache observations; Q3 remains gated.

## Owner-directed F7 continuation — 2026-10-19 18:18 UTC (in progress)

The owner requested use of connected Chrome and completion of F7, then supplied a command-specific 48-hour passwordless sudo grant for the prepared archive. Browser control repeatedly failed before tab inventory with a browser request-header-policy service error, including after reconnect and runtime reset. This is a browser-control failure, **not** an application HTTP response. A same-origin browser-console probe for the existing owner-owned disposable draft and foreign session was supplied for user execution; no returned results have yet been recorded in this section.

The current source at `b9d251fb794c67d1e8a287936be4f22af557608a` was built into `/tmp/firelaunch-q2-f7-0.6.7.tar.gz`, SHA-256 `ce44686dbab8546a12edb4f2101cb5502875bc94fe803ae899b7fd4f84bff6b2`, using Node 24 and cached npm 12.2.0. The archive was transferred to the existing staging incoming directory and rehashed there with the same value. The operator's exact command-specific sudo rule expires `2026-10-21 18:12:13 UTC`; no general root grant was added.

The protected `/opt/firelaunch-staging-ops/deploy-release.sh` succeeded. It verified a new encrypted predeploy schema-13 archive `/var/backups/firelaunch-staging/20261019T181516Z-ce44686dbab8-pre-deploy-schema-13.flrec` (SHA-256 `631df71a518120fbc0d00b5988a17f3a257ead2bc87d55f65ec1ad4b23605f9d`), kept schema **13**, and activated `/srv/firelaunch/releases/20261019T181516Z-ce44686dbab8`. `/srv/firelaunch/previous` now points to the former `/srv/firelaunch/releases/20261018T201026Z-4e4fde123451`. A fresh read found `firelaunch-staging.service` active, the retired 4185 service inactive, and deployed `api.js` / `media-upload-service.js` hashes exactly matching the tested local build (`6dc57178f30f538ab2e0974dce33594547bf6596638ae2053bca5061b2d2d289` / `93e396213218304743b6fb1a15baf4ddf2cb892c9efd37fbdaacfffa8c803a5e`). Studio HTTPS returned 200; the public pointer body hash stayed `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059` for release #1. The new revocation route is **deployed but not yet live-qualified**; no route call or media mutation occurred.

Scoped local AWS CLI sessions currently return `ExpiredToken`, so no fresh provider, CloudFront or cost readback has been claimed for this continuation. The owner was asked for an explicit rights assertion and one-job approval for the generated test pattern, and for refreshed temporary AWS sessions. No private upload, new encode, viewer-function change, second release, revocation or invalidation has occurred. **F5/F6 remain PASS for the retained release #1 evidence; F7 remains PARTIAL and Q2 NOT GREEN.**

At 18:18 UTC the owner affirmed rights to use the exact generated MP4 (SHA-256 above) and approved one private upload and at most one paid MediaConvert job. This is **not** creator approval for a public test release, CDN viewer-function expansion, revocation, delivery cleanup or invalidation. The owner also directed refreshing the existing scoped AWS CLI profiles from the already open access portal; the browser control service still failed before tab inventory, so no portal token was read, copied or written to the local AWS configuration and STS remained expired. These are pending execution dependencies, not F7 test results.

## F7 owner/foreign probes and provider recheck — 2026-10-19 18:39 UTC

The owner later ran the supplied same-origin console probe in two separate Google sessions and pasted the result objects. This is **user-reported live browser evidence**, not a probe independently operated by this agent. Both results identify the same complete disposable-draft target hash `2b4e84242beb92db3189b50daab79f23c842a794fef7e5018a4dbee1e79d69ce` for `ch_afc823551f2a4a52bb065507874e44c4`. Owner account hash `252c088ee090498a` read the draft with HTTP 200, made one valid CSRF write with HTTP 200 in each of two runs, and read back the saved revision and content hash: revision 1→2 and 2→3. Each missing-CSRF and invalid-CSRF write returned HTTP 403 with code `CSRF`. In each run, `afterHash` equaled `savedHash`, showing the denied requests did not overwrite the valid saved draft. The second account hash `7d3a414d7ad8af41` identified role `foreign`; its draft GET was 404 before and after the probe, catalog GET was `[404, NOT_FOUND]`, and an own-session-CSRF catalog import preview POST to the same project returned `[404, NOT_FOUND]`. The foreign probe did not perform a project PUT. These observations close the **tested** cross-account read/catalog-preview and owner missing/invalid CSRF response classes; they do not prove every private route or live revocation behavior.

The owner approved replacing the first silent file with the locally generated 12-second 1280×720 H.264/AAC test clip `/tmp/firelaunch-f7-av-disposable-20261019.mp4`, SHA-256 `ea64750110714a878962e0e29fdb04bf949716b692ab1b654e1d918ff843c617`, for the already limited **one private upload and at most one paid MediaConvert job**. No approval for a public test release, CloudFront function expansion, lifecycle revocation, delivery cleanup or invalidation was supplied. The owner then stated they were driving and could answer no more questions; no additional approval was requested or inferred.

The temporary `firelaunch-deployer` and `firelaunch-developer-jfin` AWS CLI sessions were refreshed from the owner's already-open AWS access portal into the existing local AWS credentials file. Scoped STS for both returned account `363242105231` and their named assumed roles; no credentials are recorded here. Fresh read-only AWS inspection: Foundation stack `UPDATE_COMPLETE`; CloudFront distribution `E3E4ESF38V413L` enabled and `Deployed`, with the existing `firelaunch-staging-approved-free-delivery` viewer-request function, the single media S3 origin, empty OriginPath and OAC `E3FC82P2MZSJ0K`. The media bucket still has all four public-access-block controls. Its delivery inventory contains only release #1's seven approved objects. `firelaunch-staging-encode` is `PAUSED`, on-demand; `firelaunch-staging-mediaconvert-jobs` is `DISABLED`. The separate audit rule is enabled. The account's `firelaunch-staging-monthly` alert budget is $20, with AWS reporting $0.0 actual at this read; it is an alert, not a spend cap. The existing approved CloudFront master returned 200 with HLS MIME, a syntactically valid unapproved asset path returned 403, and the public-only TV host returned 404 for `/api/projects`.

The newly deployed owner-scoped revocation route has still not been invoked. Chrome control continued to fail before request inspection, and a separate in-app Studio tab stayed blank, so this agent could not use an authenticated creator session to submit the approved private upload. No upload, MediaConvert job, queue/rule change, viewer-function change, public release, revocation, S3 cleanup or CloudFront invalidation was performed. The private-encode approval does not authorize the distinct queue/rule activation or later public/revocation gates in the Q2 prompt. Release #1's seven objects and public pointer remain untouched. **F5 PASS, F6 PASS, F7 PARTIAL; Q2 NOT GREEN; Q3 UNSTARTED.**

## Final F7 disposable execution — 2026-10-19 19:53 UTC

The owner approved the exact 15-second `/home/jfin/Videos/av_test_15_seconds.mp4` (SHA-256 `c01d54be87384f419d38aad2528558218f7f38a152c945707e95d39d03429152`) for a complete, bounded F7 run. The owner-signed-in Studio privately uploaded it to disposable project `ch_afc823551f2a4a52bb065507874e44c4`; the S3 original hash matched. The existing MediaConvert queue and completion rule were temporarily activated by a reviewed Foundation change set. Exactly one new job, `1792437846409-yvxkb0`, completed; the application showed READY and a complete private two-variant, six-segment HLS graph. The separate FREE release `rel_0cdade49a649430a8f5251d8a6479787`, sequence 1, manifest SHA-256 `856e2dbc06a1941d8cf88c5aa4ee2cea8bbfe51db00e890096465ef76621aa86`, was published through creator review/confirmation. Release #1 was not modified.

A reviewed temporary CloudFront viewer-function change kept the original exact seven-file allowlist and added only this rendition's nine exact filenames. The CDN returned 200 with matching bytes/MIME for all nine HLS objects; cached reads were observed, and adjacent unapproved names returned 403. The deployed Studio lacks a UI action for its deployed owner-scoped video lifecycle revocation route. A focused UI fix is built, typechecked and staged as archive SHA-256 `41f10bd0e1a35b4954a25af97bacc2fdc4e7d396887d8deb38a26da8387c4fa2`, but the existing passwordless sudo grant is exact to the *previous* archive; the protected new deployment attempt stopped at `sudo: a password is required`. The video's lifecycle route was therefore **not** called. The disposable public artwork's TV display right was revoked through the existing owner Studio workflow; this is weaker than video lifecycle revocation. The live disposable resolver 404 was not directly measured.

For safe teardown, exact nine-path invalidation `I3EINJOX50O23FMAPK6RZ759CO` completed and the original viewer policy was restored. All nine disposable CDN paths then returned **403**. The Foundation stack returned `UPDATE_COMPLETE`; the actual queue is **PAUSED** and the completion rule **DISABLED**. The nine origin delivery copies remain private behind the restored viewer guard pending lifecycle revocation and guarded cleanup. Release #1's CloudFront master remained **200** with its original SHA-256; its public pointer remained **200** with original body SHA-256 `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059` and original release ID. See [R3 live evidence](qualification/q2-f7-final/R3-revocation-cache.md) for exact identifiers and cache results.

**Disposition: F7 PARTIAL; Q2 NOT GREEN; Q3 UNSTARTED.** The one remaining execution blocker is the command-specific operator grant for the prepared UI-only staging repair. After that repair is deployed, exercise the existing owner/CSRF video revocation route and verify the public resolver's fresh denial, then run guarded origin cleanup. Do not submit another paid encode job or republish release #1.

## Final F7 closeout continuation — 2026-10-19 20:28 UTC

The host's renewed time-limited sudo grant was present. The prepared `/home/deploy/firelaunch-incoming/firelaunch-q2-f7-ui-0.6.7.tar.gz` rehashed to the expected SHA-256 `41f10bd0e1a35b4954a25af97bacc2fdc4e7d396887d8deb38a26da8387c4fa2`. The protected root-owned `deploy-release.sh` accepted that exact archive/hash, verified schema 13 and HTTPS health, created and verified encrypted predeploy backup `/var/backups/firelaunch-staging/20261019T202804Z-41f10bd0e1a3-pre-deploy-schema-13.flrec` (SHA-256 `0eb7f2e91678916c306560fc419feffdacdfe0850ae401f8d88d03f56892e7e3`), and activated `/srv/firelaunch/releases/20261019T202804Z-41f10bd0e1a3`. `/srv/firelaunch/previous` points to the prior schema-compatible `20261019T181516Z-ce44686dbab8` release. The sole canonical `firelaunch-staging.service` remained active; the retired service remained disabled. Studio HTTPS returned 200, its served JS bundle contained `Revoke selected video` and the owner-scoped `media-uploads/revoke` call, and unauthenticated local and HTTPS session endpoints returned the expected 401. Authenticated Google sign-in was **not** independently retested.

Read-only PostgreSQL inspection identified the disposable project's sole managed video as `ma_05101b9e81ce467a8ccaa8a5bcdb53bb`, with processing state `ready` and no lifecycle revocation. The disposable publication remains `dep_6ec5f189cb774a4197d3801e538178d1` / `rel_0cdade49a649430a8f5251d8a6479787`. Fresh public resolver current and immutable release requests returned 404; this denial already followed the earlier artwork-right revocation and **does not prove video lifecycle revocation**. All nine exact disposable CloudFront HLS paths returned 403 again. S3 listing showed the same nine disposable delivery objects still present; no origin deletion occurred. Release #1's pointer and master stayed 200 with original raw-body SHA-256 `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059` and `7874303d9ceabcf880f5086d9a995b5ff010dd8c05fdc4424a5ab08842829494`. Fresh AWS readback showed the MediaConvert queue `PAUSED` and completion rule `DISABLED`.

Focused Studio typecheck and build passed; `git diff --check` passed. The requested signed-in Chrome tab was absent from the browser inventory, and an attached creator session was requested. No mock or unauthenticated revocation request was substituted. The exact pending dependency is the attached signed-in owner Studio Chrome tab; then revoke only this video through the UI, confirm durable database state and fresh publication denial, and run the guarded operator cleanup for its nine origin copies. **F7 PARTIAL; Q2 NOT GREEN; Q3 UNSTARTED.**
