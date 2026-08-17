# Architecture

The browser talks to NestJS (`NEXT_PUBLIC_API_URL`, `session` cookie). Next.js does not check permissions: the trust boundary is the API. JSON and SSE go to the API locally and, in production, to same-origin `/backend` (a rewrite to Render) so the cookie is first-party. PDF bytes go to the API host with a short-lived upload ticket: they do not pass through Vercel. PostgreSQL stores metadata, the tree, access, and the activity log. PDF bytes live in R2 or on disk. The file is exposed through a temporary signed URL, not a permanent URL.

Monorepo: `apps/nextjs-frontend`, `apps/nestjs-backend`, contract `@sdr/shared`. Libraries and versions — [stack](./stack.md).

Production: Next.js on Vercel; NestJS API and PostgreSQL on Render.


## Principles

1. **The API computes permissions on every request.** The UI is not the source of truth. `ResolveService`: owner, a covering grant, or a public token. No access → `404` (someone else's resource is indistinguishable from a missing one). Can see, but cannot write → `403`. The client does not send `ownerId` or `storage_key`.
2. **PostgreSQL is the source of truth for a file.** No row — the file does not exist in the app. An orphan in the bucket is possible; it is not in the listing.
3. **Permissions are not copied onto every file.** A grant on a room or folder covers descendants via `path`.
4. **We do not grant again what an ancestor already covers.** If a person already has an active grant or a pending invite on a room or folder, a narrower grant on a file or nested folder inside it is not created — `409 already_covered`. Narrow first, then wide — allowed: revoking the wide one does not remove the narrow one. Public links do not run this check.
5. **No permanent object URL.** After ACL the backend issues a link for ~15 minutes. Revoke cuts off new issuances; an already issued link lives until TTL.
6. **Slow operations stay outside the DB transaction:** bcrypt, `storage.put` / `storage.delete`, signed URL. `$transaction` is only for Postgres (`maxWait` 2s, `timeout` 5s).

## How it is built

Pages call an axios client; responses are validated with Zod from `@sdr/shared`. There is no BFF and no Next.js Route Handlers: production `/backend` is a rewrite, the UI does not read the session. Global `SessionGuard` and `CsrfOriginGuard`. `@Public()` does not require a session, but attaches the user if a cookie is present.

Upload: `POST /files/upload-ticket` (session) then `POST /files` (cookie or `X-Upload-Ticket`) → write → `storage.put` → file row or a new version in Postgres. Read: `GET /files/:id` (cookie and/or `?token=`) → read → `downloadUrl`. Versions: `GET /files/:id/versions` and `.../:versionId`. The browser opens the PDF via a signed GET to R2 or `GET /storage/objects` (local driver).

**Search.** `GET /search?q=&dataRoomId=` (optional `?token=` and a cursor). Substring match on file and folder names, only inside what the caller can already read: owner, covering grants, or the public-link target. This is not folder listing and does not walk the tree in the API. PostgreSQL `ILIKE` with escaped `%` / `_` and `pg_trgm` indexes. Keyset pagination on `(name, kind, id)`. Hits are for navigation; writes stay in listing.

**Drive.** One room per owner (`data_rooms.owner_id` is unique), created at registration. Folders: `parent_id` for children, `path` of UUIDs (`/id/id/`) without names — rename does not touch the subtree. Folders are not moved: otherwise `path` would have to be rewritten on descendants. Depth — 32 levels, `path` up to 2048 characters. File and folder are bound to the room with a composite FK: a node cannot be hung on a parent from another room. A file moves only inside the room.

The object key is assembled only by the server: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. The name is not part of the key: rename and move change Postgres, the object is not copied. Upload of the same name into the same folder (with write) — a new version of the same `file.id`. Folder name conflict, rename, or move → `409 name_taken`. Folder and file uniqueness are separate.

**Access.** A grant on a room, folder, or file (`viewer` / `editor`), exactly one target. Write — owner and editor; share — owner only. You cannot grant access to yourself or to the owner. A public link is always viewer. At most one active grant per (user, target) pair and one public link per target. A repeated grant through this API does not raise the role; accepting an invite, if a grant already exists, can raise `viewer` → `editor`. Revoke is `revoked_at`, not DELETE.

Coverage: a room — all contents; a folder — itself and descendants. Overlapping grants — principle 4. Multiple grants combine by maximum role. Breadcrumbs show only ancestors on which there is a role. A grant on a single file does not open the parent or siblings: those nodes appear in incoming shares, not as someone else's drive. “Shared rooms” contain only grants on the whole room. To drop inherited access — revoke it on the ancestor where it was granted.

If the email is not registered yet — an invitation: token in the URL, SHA-256 in the database, 7 days. The invitation itself does not grant access; pending invites are accepted on login or registration.

**Liveness and activity log.** `GET /events` (SSE): after a revoke/delete commit the server pushes an event, the client refetches REST. The source of permissions is still `ResolveService`. The connection registry lives in process memory.

The `activity_events` log is append-only, with no FK to file/folder; the name is in `resource_name` — history survives delete. Only the owner can read it (`GET /data-rooms/:id/activity`). The live event `activity_recorded` updates an open feed.

## Decisions

| What we did | Why | Cost |
| --- | --- | --- |
| One room per `owner_id` | a simple ACL root for the MVP | cannot have several drives |
| `path` of UUIDs, not names | rename does not rewrite the subtree | folders cannot be moved |
| Name not in the storage key | rename/move without copying the object | only the server knows the key |
| Upload of the same name = version | no silent overwrite and no `file (1).pdf` | listing is one row |
| ACL via `path` at request time | do not copy permissions onto every file | no exceptions from a folder |
| Revoke = `revoked_at` | history + uniqueness only for active ones | the table grows |
| SSE in process memory | simple for a single instance | several replicas without Redis may miss a push |
| Signed URL ~15 min | bucket is closed, no permanent URL | revoke does not kill an already issued link |

## Two stores

Postgres and object storage are not in one transaction.

**Upload:** `storage.put`, then a Postgres transaction (`files` + `file_versions` + `current_version_id`). Transaction error → compensating `storage.delete`. If delete also fails — an orphan in the bucket, the file is not in the listing.

**Delete:** version keys are collected **before** `DELETE` (otherwise CASCADE would wipe `file_versions`). Then a Postgres transaction: grants and links cascade, the log entry is in the same transaction. After commit — best-effort `storage.delete`. A storage error does not roll back Postgres.

**Races.** Two concurrent uploads of the same name → `P2002` is handled as a new version of the same `file.id`. Create / rename / move when the name is taken → `409`. Move into an already deleted folder (`P2003`) → `404`. Parallel rename — last-write-wins. Foreign keys do not leave a dangling `parent_id`. Registration: user, session, and room in one transaction; invite accept comes after — an invite error does not roll back the account. If a room for the owner already exists (`P2002`), the existing one is used.

## Limits

What is not in the product — [README](./README.md). Signed URL after revoke, CSRF without Origin — [security](./security.md). Listing, search, and replicas — [how it scales](./how-it-scales.md).

What is specific to this page:

- The same name for a folder and a file in one directory is theoretically possible.
- Old keys `{prefix}/{dataRoomId}/{fileId}` on files already stored are not rewritten.

## Where the code is

Frontend: `page.tsx` → screen UI → hook → `app/api` → axios. The page does not call axios. A screen component does not import `api/*`.

Backend: controller → one-operation service → Prisma repository.

Request and response contract — Zod in `packages/shared` (`@sdr/shared`). Both apps import the same schemas.

### Frontend — `apps/nextjs-frontend/src`

```
app/
├── layout.tsx                 # root layout: fonts, providers
├── page.tsx                   # landing /
├── globals.css
├── (pages)/                   # parentheses do not appear in the URL
│   ├── login/                 # /login
│   ├── register/              # /register
│   ├── drive/                 # /drive — own drive, shares, activity log
│   └── share/                 # /share — public-link entry, not inside drive
│       └── components/        # UI for this screen only (login/register/drive are the same)
├── hooks/
│   ├── queries/               # TanStack Query: me, folder, file, shares, activity log
│   ├── mutations/             # login, upload, rename, share, revoke…
│   ├── use-live-access.tsx    # SSE: revoke and delete on an open tab
│   └── use-live-notice.tsx    # toast from a live event
├── api/                       # one file per endpoint: axios + zod
│                              # *.fetcher.ts — GET, *.poster.ts — mutations
│                              # these are not Next Route Handlers; there is no route.ts here
├── lib/                       # query-keys, SSE URL, live-event copy
└── components/                # shared across screens: login shell,
                               # access duration picker, version history, PDF watermark
components/                    # app-wide primitives: button, dialog, theme, toast
infrastructure/http/           # axios instance (withCredentials) and API error parsing
providers/                     # QueryClient, theme
store/                         # Zustand: theme, drive view, toasts — only what is not on the server
lib/                           # API error copy, cx
```

`(pages)` is not a module. Without the parentheses the path would be `/pages/login`. Share is a separate entry: a guest with a token must not live inside `/drive`.

| What | Where |
| --- | --- |
| UI of one screen | `app/(pages)/<page>/components/` |
| Hook or request used on 2+ pages | `app/hooks`, `app/api` |
| Shell for 2+ pages | `app/components` |
| Button, input, theme | `src/components` |
| Query cache keys | `app/lib/<feature>.query-keys.ts` |

### Backend — `apps/nestjs-backend/src`

One module = one domain. Inside, always the same layout:

```
files/
├── files.controller.ts        # HTTP: path, pipes, guards
├── files.module.ts
├── files.repository.ts        # Prisma, no business logic
├── files.constants.ts
├── services/                  # one operation — one file
│   ├── upload-file.service.ts
│   ├── get-file.service.ts
│   └── …
└── utils/
```

The controller does not talk to Prisma and does not compute ACL: it calls a service. The service calls `ResolveService` and the repository.

```
modules/
├── auth/                      # registration, login, logout, me
│                              # SessionGuard, CsrfOriginGuard, @Public(), cookie
├── data-rooms/                # one room per owner: create, get, list
├── folders/                   # tree: create, contents, rename, delete
├── files/                     # upload, get, versions, move, rename, delete
├── search/                    # GET /search — name across the room, ACL in SQL
├── access/                    # grants, invites, public links, revoke
│                              # ResolveService — role on room/folder/file
├── activity/                  # activity log: view/download records, summary, feed
└── events/                    # GET /events — SSE, in-memory connection broker
infrastructure/storage/        # driver: local (GET /storage/objects) or R2
│   ├── storage.service.ts     # put / delete / signed URL
│   ├── storage-key.ts         # {prefix}/{room}/{file}/{version}
│   ├── local/
│   └── r2/
database/                      # PrismaService, transactions, Prisma error mapping
main.ts                        # CORS, cookie, global guard/filter/pipe
app.module.ts
```

Table schema lives in `apps/nestjs-backend/prisma/schema.prisma`, not in `src`.

### Contract — `packages/shared/src`

```
auth/          # login, register, me, user
files/         # upload, file, versions
folders/
data-rooms/
access/        # grant, invite, public link, incoming/outgoing
activity/
search/        # GET /search query and hits
events/        # SSE live-event shape
http/          # API error shape
```

The frontend validates responses with these schemas. The backend validates the request body (`ZodValidationPipe`). To change an API field — change it here, do not copy the type in two apps.
