# P4 public HTTPS staging boundary (not qualification evidence)

The server binds `127.0.0.1:4174` and **must run in hosted mode** with its private database and authenticated creator routes kept behind a separate access boundary. This example is for a temporary, owner-controlled, device-reachable hostname with a valid certificate. It is not a production hosting recipe or proof that a Vega VirtualDevice can reach it. Do not tunnel the whole server, local-legacy mode, MinIO, PostgreSQL, Studio, or `/api`.

The only anonymous wire paths are `GET /public/v1/deployments/dep_<32 lowercase hex>/current` and `GET /public/v1/deployments/dep_<32 lowercase hex>/releases/rel_<32 lowercase hex>`. The first returns `{deploymentId, releaseId, releaseSequence, sha256}` (the SHA-256 of the immutable manifest bytes) with `max-age=0, must-revalidate`; the second returns **exactly** those published manifest bytes with a quoted SHA-256 ETag and `max-age=31536000, immutable`. Both return JSON, are bounded to 1 MiB stored manifest bytes, and reject queries, encodings, extra path segments, methods other than GET, ranges, and request bodies. Unknown, unpublished, mismatched or corrupted releases return 404 without draft details. No public route accepts an owner ID or session token.

Illustrative Nginx allowlist for a dedicated **public-only** vhost (supply real certificate paths and a separately configured trusted hostname/TLS service before using it):

```nginx
limit_req_zone $binary_remote_addr zone=tv_public:10m rate=10r/s;
server {
    listen 443 ssl;
    server_name tv-stage.example.net;
    ssl_certificate /path/to/approved/fullchain.pem;
    ssl_certificate_key /path/to/approved/privkey.pem;
    client_max_body_size 1k;

    location ~ ^/public/v1/deployments/dep_[a-f0-9]{32}/(current|releases/rel_[a-f0-9]{32})$ {
        if ($request_method != GET) { return 404; }
        if ($args != "") { return 404; }
        limit_req zone=tv_public burst=20 nodelay;
        proxy_set_header Host tv-stage.example.net;
        proxy_set_header Cookie "";
        proxy_set_header Authorization "";
        proxy_set_header X-CSRF-Token "";
        proxy_pass http://127.0.0.1:4174;
    }
    location / { return 404; }
}
```

The backend URL must not be externally reachable except through this allowlist. Enforce firewall/loopback binding, TLS validity, upstream and response-size limits and monitor edge denials; do not relax the route to a general `/public` or `/api` proxy. Use a pinned HTTPS origin in the future native client; do not use arbitrary redirect targets or publish tokenized media URLs. Before P8 manual qualification, verify anonymously from the **actual installed-device network**: current and matching release success, `If-None-Match` 304, unrelated deployment 404, every `/api`, Studio, MinIO and database origin unreachable, and bad/missing TLS rejected. Record real host, exact installed VPKG, hash and device observations then; HTTP fixture tests do not establish HTTPS reachability.

Historical published release URLs are cacheable and cannot be globally erased from offline devices by changing the live pointer. A rights revocation prevents *new* publication under the P3 approval checks, but does not instantly revoke already-cached releases. Emergency tombstones, asset deletion/retention and device refresh policy need separate design and validation. Phase 4 provider and hosted S1–S6 gates remain open.
