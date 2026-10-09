# FireLaunch Vision

## Problem and audience

Video, audio, and writing professionals who already sell work in the Amazon ecosystem want a branded television destination without learning Fire TV development, focus navigation, packaging, or Appstore submission.

## Product promise

**Your Amazon catalog. Your own Fire TV channel.**

FireLaunch turns a creator's existing, authorized catalog and licensed media into a television-native channel. It offers AI-assisted generation, a visual TV editor and Preview, creator-owned Vega source and publishing guidance, and ongoing remote content synchronization.

**Individual ownership is non-negotiable.** Each channel is a distinct branded application submitted and controlled through its creator's Amazon Developer account. FireLaunch is the builder/management service, not a single viewer app aggregating creators. Creator assets, content, app identity, listing, code and release decisions remain independently owned and exportable.

## Default creator journey (post-P0 launch MVP)

1. Create an account and a channel project.
2. Supply an Amazon seller/author identity or URL as a discovery clue, or directly import a creator-controlled feed/file. Public identity is not proof of ownership and does not guarantee supported Amazon data access.
3. Review imported works, provenance and rights. Attach playable video/audio or other appropriate, licensed television material.
4. Generate a meaningful design tailored to video, audio or writing: films and trailers; albums, audio samples and episodes; or an author bookshelf with readings, interviews and companion media.
5. Customize and approve through the Studio, Preview or ChannelAgent. Prompt-first creation remains available as an alternate entry. The ordinary workflow does not require code.
6. Export/build a creator-specific Vega project, qualify it on television and submit through the creator's own Amazon Developer Console.
7. Publish an approved, versioned channel manifest and synchronize supported source changes to the installed app, without a new binary for ordinary compatible catalog/layout updates.

A product listing is not a playback license. A sparse list of product cards is not a sufficient television experience. Separate rights, quality and integration-permission gates apply to every source.

## Product boundaries

- `ChannelSpec` remains canonical for TV layout and navigation; catalog/source/sync state is a separate, versioned domain.
- Vega is the launch target; exported source and direct code editing remain available for advanced creators.
- Only approved integrations may import/display Amazon data on TV. KDP, Audible, Seller Central and affiliate data are different ecosystems; no universal connector is promised.
- Publish is separate from drafts; content rolls out via immutable manifests with caching, compatibility checks, rollback and guarded creator overrides.
- New app permissions, native code or incompatible runtime changes still require a qualified new package and the applicable Appstore review.
- No shared FireLaunch viewer app, team workspaces, multi-TV platform exports, viewer purchases or advertising in launch MVP.

## Historical P0 hackathon scope

P0 demonstrated a prompt-first Wild Earth product concept built around **Prompt -> Product -> Real Television**. P7 closed NOT GREEN at version `0.0.7`: browser Preview and source output were tested, but live Vega VPKG/device execution and broad live Bedrock requests were not established. The active `c0-real-tv-qualification` correction owns that evidence gap and is separate from the new launch-MVP roadmap.

See [MVP roadmap](roadmap/mvp-roadmap.md).
