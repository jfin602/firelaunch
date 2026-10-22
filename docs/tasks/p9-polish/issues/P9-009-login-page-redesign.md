# P9-009 — Formal FireLaunch login screen with approved cyberpunk canyon background

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required presentation polish  
**Status:** Reported and visual direction owner-approved; implementation not started  
**Reported:** 2026-10-22 13:50 UTC; **image approved:** 2026-10-22 13:52 UTC  
**Surface:** Anonymous / signed-out / expired-session Creator Studio login screen at `https://firelaunch.jfin.dev/`

## Original problem and owner direction

The existing login screen consists of a plain almost-black page, large "Sign in to FireLaunch" text, "Your session has ended or you have not signed in", and a tiny unstyled/orange link "Sign in with Google". It lacks the finished Creator Studio's Desert Heat identity.

Owner: **"formalize the login page, give it a super cool cyberpunk canyon with the desert heat color scheme, then a nice compact login form in the center. add this to the list then generate a sample of the background image"**.

A 16:9 cinematic **cyberpunk canyon** background sample was generated in the issue-collection conversation, and the owner explicitly accepted it: **"thats awesome. thats what we'll use. add this to the issues list"**.

## Approved visual reference / asset provenance

- **The generated canyon image from the 2026-10-22 13:50–13:52 issue-collection exchange is the owner-selected asset**, not just general inspiration.
- It depicts dramatic dark sandstone walls with futuristic neon-orange light strips/structures, orange/red haze and light in the canyon distance, a reflective dark rocky floor, and a relatively open central region to support an overlaid login card.
- The original image was generated in the conversation as a 16:9 sample; retrieve/preserve that **exact generated image** for implementation and check it into an appropriate Studio static asset path with optimized size and measured load behavior. **It has not been committed as a binary to this documentation branch.** Do not substitute an unrelated stock canyon scene or claim the asset is already in the repository.
- The login screen must use it as a **full-bleed decorative background** with proportion-preserving cover cropping, tasteful charcoal scrim/vignette to keep form legible, good readability on narrower viewports and no stretching.

## Desired login layout

1. Full-viewport background, without Studio navigation/sidebar before authentication.
2. One **compact centered translucent-charcoal login card** (not a long full-width form) using FireLaunch/Desert Heat rounded corners, restrained borders/shadow, clean typography, orange reserved for the Google sign-in CTA.
3. Logo/FireLaunch Creator Studio brand at the card top, concise inviting title/subtext rather than a broken-looking naked session warning.
4. Real, obvious **Sign in with Google** button with branded text and clear loading/disabled/error states; preserve its actual existing Google OIDC flow/redirect/callback.
5. For genuinely expired sessions, show a short polite explanatory message within the card. Otherwise use a neutral welcome. Do not misleadingly show an error to every signed-out visitor.
6. Desktop, tablet and phone: maintain centered compact card and responsive cover background; make sure every sign-in control remains visible without horizontal overflow. Respect focus, keyboard, screen readers, dark contrast and reduced-motion.
7. If the background image cannot load, retain a visually consistent solid dark fallback rather than showing blank/white content or making sign-in unavailable.

## Acceptance criteria

- Signed-out and session-expired states display the approved canyon image behind a polished, centered Desert Heat login card, not the old plain text view.
- Google sign-in button is prominent, keyboard operable, and invokes **existing real authentication**, preserving login, logout, expiry and redirect behavior.
- Form remains readable and useful with background enabled and on a narrow/mobile viewport; no stretched background, clipped CTA or scroll trap.
- Expired session displays truthful concise feedback; ordinary first visit doesn't show false session error.
- No sensitive token, account identifier or auth details appear in query strings or browser logs beyond existing authorized behavior; no auth bypass, new identity provider or backend security scope.
- Confirm owner-authenticated staging browser flow, refresh, sign-out, fresh sign-in and session expiry handling; deploy only through existing protected staging practices.
- Verify the **exact owner-approved image asset** was retrieved from the conversation and intentionally added to runtime code/assets before claiming delivered.

## Dependencies / limits

- Visual styling should harmonize with **P9-007 shared popup design**, but the login card is a standalone auth screen, not literally a modal dialog.
- Avoid extended animation, particle systems, background video, or expensive effects; keep first paint and Google sign-in fast.
- Document-only intake: **not implemented or deployed** by this issue record.
