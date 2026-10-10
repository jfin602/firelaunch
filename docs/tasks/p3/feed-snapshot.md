# P3 one-shot HTTPS feed snapshot (0.3.4)

An authenticated creator first creates a `creator_https_feed` CatalogSource with a public HTTPS `endpointUrl` and `permission.retrieval: creator_asserted`. This is a recorded creator assertion; it does not verify television display or playback rights. The server reads the endpoint from the owned source. `POST /api/projects/:projectId/catalog/imports/feed-preview` accepts `{ "sourceId": "src_..." }` and returns the usual import plan plus `content`, a normalized JSON row snapshot. The creator reviews rows and issues, then calls `POST /api/projects/:projectId/catalog/imports/feed-approve` with `{ "sourceId", "content", "expectedRevision", "fingerprint" }` from that preview. Approval requires the matching owner-scoped, 15-minute receipt and current catalog revision. It does not fetch again, poll, publish, or remove absent items. The common hosted session and CSRF guards apply to both calls.

Supported feed subset:

- JSON Feed 1 or 1.1: `items[].id`, `title`, optional `summary`, `image`, and optional `_firelaunch_kind` (`video`, `audio`, `book`, `listing`). Other fields are ignored.
- RSS 2: `channel/item/guid` (falling back to `link`), `title`, optional plain-text `description`, and optional `firelaunch:kind`.
- Atom: `entry/id` (falling back to `link href`), `title`, optional plain-text `summary`, and optional `firelaunch:kind`.

Items without stable IDs or titles fail. Kinds default to `listing`; no media URL is treated as playable. IDs that do not fit the catalog's external-ID syntax become a deterministic SHA-256 `feed-...` ID; `sourceRecord.rawExternalId` retains the original feed ID. The catalog keeps source-scoped identity, observed metadata and creator overrides separately. Invalid metadata and duplicate IDs appear as preview issues and block approval.

Each fetch is limited to public HTTPS on port 443, three redirects, eight seconds total, 512,000 response bytes, and 1,000 items. Every redirect destination is checked. All resolved A/AAAA answers must be public; the HTTPS connection is pinned to one validated answer while TLS still verifies the requested hostname. Local, private, link-local, cloud metadata, mapped and transition addresses are denied. Compressed responses, XML doctypes and processing instructions, malformed XML, and XML nesting beyond 16 levels are rejected. Only the listed JSON/XML MIME types are accepted. This is an initial snapshot feature; scheduled refresh belongs to Phase 6.
