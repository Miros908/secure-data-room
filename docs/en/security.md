# Security

The trust boundary is the **NestJS API**. Next.js does not check the session in middleware and does not interpret the cookie: if you bypass the UI, the rules are the same — cookie or upload ticket, Origin, `ResolveService`.

The UI and the API are different hosts in production (Vercel and Render). A session cookie has to be first-party, otherwise the browser will not keep it. JSON and the live stream therefore go to same-origin `/backend`; Next rewrites that path to the API. PDF bytes go to the API host directly: Vercel will not carry a 25 MiB body.

## Session

Login and registration create a server session, not a JWT.

An opaque token is placed in the `session` cookie: 32 random bytes (`randomBytes`), in hex. `auth_sessions` stores only SHA-256. A leaked DB dump does not give a ready cookie: you would have to brute-force the hash preimage.

Why not a JWT in localStorage: the token is reachable from JS via XSS; logout does not revoke an already issued JWT until it expires. Here logout sets `revoked_at`, the cookie is `httpOnly` — page script cannot read it. Session lifetime is 12 hours (`SESSION_TTL_MS`).

Cookie flags (`getSessionCookieOptions`):

| Environment | SameSite | Secure | Partitioned |
| --- | --- | --- | --- |
| development | `Lax` | no | no |
| production | `None` | yes | yes (CHIPS) |

Locally the UI on `:3000` and the API on `:4000` are one site from the browser's point of view, so Lax is enough.

In production they are different sites (`deal-box.vercel.app` and `*.onrender.com`). A `Set-Cookie` from the API host is third-party for the tab with the UI; browsers do not store it. So the client talks to same-origin `/backend` (`NEXT_PUBLIC_API_URL`). Next rewrites `/backend/:path*` to `API_PROXY_ORIGIN`. Login's `Set-Cookie` comes back on the UI host and is first-party.

PDF upload is a separate hop: Vercel will not proxy 25 MiB. `POST /files/upload-ticket` goes through the session (same-origin). `POST /files` then goes to `NEXT_PUBLIC_UPLOAD_API_URL` with `X-Upload-Ticket`. The ticket is HMAC of the session hash, lives 10 minutes, and is not a general session — `UploadAuthGuard` accepts it only on upload.

`Partitioned` is written into `Set-Cookie` by `serializeSessionCookie`. Express `res.cookie` does not emit that flag; without it CHIPS would not apply if a response is ever cross-site.

`SessionGuard` is global. No cookie / session revoked or expired → `401 unauthorized`. `SUSPENDED` → `403`, not `401`: the account exists, it just cannot be let in.

`@Public()` does not require a session (login, public link, read via `?token=`, local file serving). If the cookie is still valid, the user is attached: a logged-in person on a public link stays themselves, the link does not raise the role.

## CSRF and CORS

Mutations from another site must not succeed with the victim's cookie.

There is no separate CSRF token in a form. JSON in production is same-origin (`/backend`). Upload and any direct call to Render are cross-origin. Protection is `CsrfOriginGuard` on all non-GET/HEAD/OPTIONS: the `Origin` header must be in the same allowlist as CORS (`CORS_ORIGIN`). No match → `403 forbidden`.

Why Origin, not a Synchronizer Token: a cookie on the API host is `SameSite=None` in production, so a credentialed request from the UI origin would send it. Checking Origin is the same fact a CSRF token would encode. Browser fetch/XHR from another site sets Origin itself; it cannot be forged from JS.

CORS: `credentials: true`. The browser will not accept `Access-Control-Allow-Origin: *` together with a cookie, so in development Origin is reflected, in test/production — an explicit list, otherwise the process does not start (`CorsOriginConfigError`).

If Origin is missing on a mutation, the guard lets the request through. That is how curl, e2e, and server-to-server live. Browser CSRF from another site usually sends Origin. This is a deliberate compromise, not a hole of “any site can POST”.

## Passwords and brute force

Password is bcryptjs, 10 rounds. In `users.password_hash`. Email is lowercased on write, not citext.

Login: no user, no hash, or wrong password → the same `401 unauthorized`. You cannot tell “email is free” from “wrong password” by the error code.

Registration on a taken email does not return `email_taken`: bcrypt is still computed, the cookie is not set. The client does not get logged in.

Login and register are rate-limited by `@nestjs/throttler`: 10 requests per minute (`AUTH_ABUSE_LIMIT` / `AUTH_ABUSE_WINDOW_MS`). In production `trust proxy = 1`, so the limit is by the IP behind Render, not by the single proxy address. In unit tests the throttler is off; to check it — `E2E_THROTTLE=1`.

OAuth, email verification, and password reset exist in the schema (`oauth_accounts`, `auth_tokens`), not in the product.

## Who can open what

One entry point: `ResolveService`. The client does not send `ownerId` or `storage_key`.

Order:

1. Session and `data_rooms.owner_id` match → `owner`.
2. Otherwise covering grants (room / ancestors via `folders.path` / the file itself) → maximum role.
3. Otherwise a public token (hash) → always `viewer`. The link does not raise the role of someone already logged in.

Write (`canWrite`) is allowed for owner and editor. Share and revoke (`canShare`) — owner only. An editor does not grant other people's access.

No read permission → `404 not_found`, with no distinction between “no such id” and “someone else's”. Anyone who can see the resource but whose role does not allow the operation → `403 forbidden`. You cannot probe foreign UUIDs by status differences.

Expiry: `expires_at` on a grant and a public link is checked on read (`expires_at IS NULL OR expires_at > now`). The maximum the API will accept is 365 days. An invite lives 7 days (`INVITE_TTL_MS`); `access_expires_at` is copied into the grant on accept.

More on inheritance and the three access tables — in [architecture](./architecture.md) and the [data model](./database.md). What matters here: ACL is computed on every request, not cached in a cookie.

## Public links and invites

The raw token is the same 32 bytes, SHA-256 in the database. Leaking the row does not open the link. The raw token appears once in the create response and then only in the URL.

A public link is always viewer: there is no role column. An unauthenticated visitor cannot write.

Lookups via `?token=` and `POST/GET …/public-links/resolve` are limited by `PublicAbuseGuard` (the same 10/min cap). A normal drive with a session and no `token` is not touched: otherwise listing would hit the same ceiling. `GET /search?token=` is included: an unauthenticated search with a link token is the same class of public-link traffic.

Search itself does not leak foreign names: no access to the room → `404 not_found`, same as listing. `%` and `_` in `q` are escaped so they are not LIKE wildcards. A public-link search is limited to the link target, not the owner's whole room.

## Files

Upload is PDF only: magic bytes `%PDF`, MIME in the database is forced to `application/pdf`. Limit 25 MiB (`MAX_FILE_BYTES`) — both in Multer and again in the service. The client does not set the name or the object key.

The key is assembled by the server: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. `assertSafeStorageKey` rejects `..` and `//` so the local driver cannot leave the `.storage` directory.

The bucket is private. Download is only via a temporary link after ACL (~15 minutes, `DEFAULT_DOWNLOAD_TTL_SECONDS`). If access expires sooner, the link TTL is shortened (floor not below 30 seconds).

- R2: presigned GET (not PUT).
- Local: HMAC-SHA256 of its own secret, public `GET /storage/objects`. The signature is the pass, as with Cloudflare. Signature comparison is `timingSafeEqual`. In development the secret may be the default `local-dev-signing-secret`; in production with `local` it must be set.

After revoke, new URLs are not issued. An already signed link lives until TTL: you cannot revoke an R2 object in a second without separate signed cookies / a short TTL. 15 minutes is a compromise between PDF preview UX and the window after revoke.

`Content-Disposition` is set by the server (`inline` / `attachment`); CR/LF are stripped from the name.

## Live events

`GET /events` is `@Public()`, but `EventsHandshakeGuard` runs before SSE headers. Otherwise Nest would already have returned `200 text/event-stream`, and 401/404 would be too late.

Subscription: a valid session or an active public link. A foreign `dataRoomId` in the query is silently ignored; it does not leak a `404`.

The connection registry is in process memory (limit 5 per user, 3 per public link). Several Nest replicas without pub/sub may not deliver the revoke bell. The source of permissions is still REST + `ResolveService`: after reconnect the client refetches. Push is a UX speedup, not ACL.

## Activity log

`GET /data-rooms/:id/activity` can be read only by the room owner, otherwise `404`. View/download records go through the same resolve (session or token). In API logs raw `token` / `sig` are redacted (`redactRequestUrl`).

## Client

Axios and the live stream send the cookie (`withCredentials` / `credentials: 'include'`). The session token is not stored in `localStorage`.

Login and register do not enter Drive on the JSON 200 alone. The client then calls `GET /auth/me` (`confirmSession`): no cookie — the form stays, the profile is not treated as a session. GuestOnly redirects only when `me.isSuccess`. A `401` on Drive clears the auth cache (`useRedirectUnauthorized`) and goes to `/login`.

Redirect from `/drive` for a guest is client-side (`useMe`), not Next middleware. That is UX, not protection.

Pages `/drive` and `/share`: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` — so PDF URLs and ids do not leak in Referer to search engines. API responses are also `private, no-store` (`NoStoreCacheInterceptor`).

Request bodies are validated by Zod (`ZodValidationPipe`). In PostgreSQL — Prisma, not SQL concatenation.

## Limits you need to know

- A signed download after revoke remains valid until TTL (usually up to 15 minutes).
- Deleting a file/folder first removes rows in PostgreSQL; the object in storage is best-effort. An R2/disk failure leaves an orphan; the API still returns success.
- SSE is in one process: horizontal scaling without Redis does not deliver live-revoke to another instance.
- A mutation without an Origin header passes the CSRF guard (non-browser clients).
- If sharing to an email that already exists, `InviteService` creates a grant and returns a random `token` in the response that is not written to the database. A working invite token exists only for a pending invitation.
