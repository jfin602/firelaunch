# c6-usability — Prompt assessment

Date: 2026-10-19. Status: approved design, no implementation. Correction version 0.6.7 unchanged.

## Evidence-based source gaps

- Studio VideoUpload.tsx currently renders inline in Catalog; it aborts an active upload on unmount, which is unsafe for a closeable popup.
- Catalog.tsx mixes simple creator video edits with advanced source/rights/collection/generation tools. Home.tsx cards open Catalog rather than their specific video.
- LivePublication.tsx already implements owned deployment, readiness, revision/rights checks, explicit approval and immutable channel publication. Reuse, never fork its API.
- Studio video-upload.ts enforces 250 MB, 1800 seconds and file.arrayBuffer() before SHA-256; the full-file buffer is unsafe for a 2 GB source.
- Server media-upload-service.ts enforces 2 GB and 1800 seconds; initiated multipart sessions expire in about one hour. Existing DB duration constraint permits 14400 seconds.
- Server media-storage.ts rejects >1800 seconds, >250 segments per variant and >600 HLS objects and uses 1000-key single-page listing and cleanup. Two hours at current six-second/two-variant output is about 2403 objects.
- Dated CURRENT-STATE.md: Q2 F7 PARTIAL/NOT GREEN and Q3 UNSTARTED; latest queue/rule state must be rechecked. Existing release #1 must be preserved.

## Decisions and risks

Create one popup keyed by owned project and CatalogItem, not a second catalog/workflow database. Collect metadata progressively with optional thumbnail/description/category and existing singular unchecked rights attestation; preserve distinct auditable TV display/playback claims, provenance, artwork and rights blockers. Show plain-language stage and next action from backend truth. Close/reopen while uploads and encoding continue when technically possible, with no false cross-reload file restoration. Keep direct video cards in Home and Catalog.

Two-hour support must validate all layers, incremental chunk hash, finite multipart lifecycle/TTL, safe S3 pagination and HLS graph integrity, bounded cost/time/memory, exact owner-scoped post-revocation cleanup. Align UI size with existing server 2 GB only after testing; a two-hour video may exceed 2 GB and must be rejected honestly. No broad server-cap increase without separate review.

Use existing basic Videos shelf and live channel approval: publishing may change other items and cannot happen automatically after encoding. Advanced merchandising deferred until Q3. No paid-video selector, native app export, FFmpeg worker, new public S3 origin or provider credentials.

## Stack assessment

Five focused runner implementations: (1) modal+library, (2) upload/7200-sec admission, (3) full HLS verification/pagination/cleanup, (4) progressive review+publish reuse, (5) UX and a11y regression. One independent real-browser closeout and one aggregate full check. GPT-6 Sol High for P1-P4/P6; Medium for P5. Target <=8 minutes per implementation with 15-minute hard ceiling and clear blocker handoffs.

Acceptance is local UX and test-scoped only until separate approved AWS two-hour encode, public CDN and Vega device evidence exist. Preserve old closeouts and security policy.
