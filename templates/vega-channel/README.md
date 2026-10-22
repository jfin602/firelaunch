# Generated FireLaunch Vega channel

This ordinary source tree contains the projected channel in `src/channel.json` and the shared
TV command/focus runtime in `src/tv-runtime.js`. The creator owns it; FireLaunch does not
silently regenerate over edits. Media and artwork URLs remain the creator's responsibility.

Local `assets/` paths are listed as unresolved in `firelaunch.json` and use a neutral
placeholder until the creator supplies licensed files. The manifest declares the Fire TV
home-launcher main category. Install and build with the Vega SDK and commands verified
by your locally installed toolchain; a generated tree
is not evidence of a successful VPKG build or simulator run.

A creator-bound deployment embeds `src/release-config.json` with only its package ID,
deployment ID, channel ID and pinned HTTPS origin. The installed app starts with a
brand-only, non-playable bundled offline page (not an unapproved draft), restores a
verified last-known-good release from Vega AsyncStorage,
and checks the public current pointer every minute. It accepts only newer compatible,
digest-checked, deployment/package-matching immutable releases; failures leave the
currently displayed channel intact. A new release resets TV focus to the first page
and stops any active playback. A creator-authorized rollback must have a *higher*
release sequence. No native code is downloaded or executed.

The cache is retained until replaced, cleared by the OS/user, or the app is removed;
offline clients cannot receive revocations or deletion requests until they reconnect.
These source files and their storage dependency have not by themselves been qualified
on a real installed VPKG.

Template 0.0.4 can parse capability-2 mixed-media releases. Its single W3C URL-mode
audio transport handles standalone MP3 and a book's optional audiobook; a book
without audio remains informational. The publication service still requires a
verified compatible installed package and approved immutable, public audio
delivery before such a release can go live. Generated source and local player
tests do not establish installed-device playback or public MP3 delivery.

The generated AsyncStorage alias pins the package version listed in its
`kepler-compatibility.json` for the tested SDK. The Babel namespace-export transform
lets Metro compile Zod's published `export * as` syntax while retaining the strict
release schema checks.
