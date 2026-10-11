# Opt-in P4 live provider smoke

This is a manual P8 qualification path. The P4 implementation and root tests make no paid provider request. The OpenAI adapter uses the [Responses API function-call flow](https://developers.openai.com/api/docs/guides/function-calling) over HTTPS from the server. Keep `OPENAI_API_KEY` server-side; never put it in Studio, a request body, a committed environment file, generated source or a log.

1. In the hosted server process environment set `FIRELAUNCH_AGENT_PROVIDER=openai`, `OPENAI_MODEL` to a Responses API model available to the account, and `OPENAI_API_KEY` to the server-side token. Restart the server. Alternatively, retain `bedrock` with `BEDROCK_MODEL_ID`, or `mock` for deterministic offline use. `GET /api/projects/{projectId}/agent-status` reports selected/configured status, not proof of network/model access.
2. Sign in as the creator and import/review catalog items. Explicitly select approved item IDs or collection IDs and note the current project and catalog revisions. The source's permission and separate media use rights must be set before audio/video becomes eligible. Do not include private evidence or object keys in the request.
3. From that authenticated session, POST JSON to `/api/projects/{projectId}/agent` with the session CSRF header and origin required by the hosted API. Example body (replace identifiers and revisions from the current creator's own project):

   ```json
   {
     "expectedRevision": 1,
     "message": "Inspect my selected books, add the first eligible book, then add it to a bookshelf rail.",
     "catalogSelection": {
       "expectedCatalogRevision": 2,
       "itemIds": ["ci_00000000000000000000000000000000"],
       "collectionIds": []
     }
   }
   ```

4. Check that the response identifies `openai`, reports an `inspect_catalog` result and a `saved` mutation, and increments the project revision. Reload the project from the server and inspect Preview with directional navigation and Back. A text suggestion or `agent-status.configured=true` alone does not prove a save or a live provider request.
5. Repeat with a stale project revision, a foreign project/item, an unreviewed item and rights-ineligible media. Expect conflict or refusal and no unauthorized persisted change. Record request time, selected model, safe response status, final revision and Preview observation for P8 without retaining tokens, cookies, private catalog data or full model transcripts.

The adapter caps provider responses at 64 KB, model text at 800 characters per turn, four calls per turn, eight calls across six turns, and inspected catalog pages at ten items with a maximum offset of 490. Model-generated media is limited to rights-safe selected projection content. OpenAI request failures, timeout, malformed output and invalid tools are reported without a false save claim. Model availability and external provider behavior remain unqualified until this smoke actually runs.
