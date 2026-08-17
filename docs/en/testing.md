# Tests

Permissions live in Nest, not in Next. So the main volume is HTTP tests of the API. The UI is checked on mocks; in the browser — a short smoke plus a security walk.

## Running

From the repository root.

```bash
pnpm test              # unit API (Jest) + UI screens (Vitest)
pnpm test:e2e          # HTTP Nest against PostgreSQL
pnpm test:e2e:web      # browser (Playwright)
```

`pnpm test` first builds `@sdr/shared` and generates the Prisma client (they are not in git). After `pnpm install` that is enough — you do not need `start.sh` first.

First time for Playwright: `pnpm --filter web exec playwright install chromium`.

`pnpm test:e2e` and `pnpm test:e2e:web` must not be run at the same time: both hit `secure_data_room_test`. Next to `pnpm dev`, Playwright is fine — it uses its own ports 4010 and 3100. If a previous run was stopped with Ctrl+C and the next one hangs or says the port is in use, free them: `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`; same for `4010`.

## Layers

| Layer | Where | With | Database |
| --- | --- | --- | --- |
| Unit API | `apps/nestjs-backend/src/**/*.spec.ts` | Jest, next to the code | none |
| E2E API | `apps/nestjs-backend/test/` | Jest + Supertest, real Nest | PostgreSQL |
| UI screens | `apps/nextjs-frontend/test/` | Vitest + Testing Library | none |
| Browser | `apps/nextjs-frontend/e2e/` | Playwright, Chromium | the same test DB |

There are no separate tests in `packages/shared`: schemas are checked by being used by the API and forms.

E2E API starts Nest, clears tables with `TRUNCATE`, storage is local disk, not R2. File names (`AUTH-01`, `ACL-01`) are labels; what the scenario actually checks is written in a comment at the top of the file.

## What is covered

**Isolation and session** — a foreign room, folder, file, and signed URL return `404` with no metadata. Session is only in an httpOnly cookie. CSRF by Origin, CORS is not `*` with credentials, the same `401` for an unknown email and a wrong password. Login, register, and public-link resolve are rate-limited.

**Sharing** — public token is random, hash in the database, the link is not wider than the target. Grant, invite (accept on register), overlapping grants (narrow then wide; a covered descendant — `409 already_covered`), move out of / into a shared folder, revoke, `expires_at` expiry. After revoke, new download URLs are not issued; an already signed GET can still serve until TTL. Deleting the target closes its links and grants.

**Drive** — the object key is assembled by the server, the file name does not affect the path, PDF only, size from the request body. Re-upload of the same name is a new version, not a second row; a viewer cannot append a version, an editor can; delete removes every version blob. Name uniqueness and “child from the same room” are PostgreSQL constraints. Races of create/rename/move/delete. Subtree delete becomes `404` immediately, a repeated DELETE is not 500.

**Search** — `GET /search` is ACL-scoped (ACL-16): owner, covering grant, or public-link target. Wildcards in `q` do not match everything. Nested files are found; listing still returns only direct children (PERF-09).

**Live and activity log** — SSE (handshake, grant, revoke, delete, public link; a stranger does not get another room's events) and activity on the API: view is `POST` not `GET`, download on every click, the dashboard is owner-only, a public visitor is stored without the token. In the browser — closing the PDF after revoke or after the link is turned off, a shared folder closing on delete, and “Link visitor” in the owner's log.

**UI** — forms, upload queue, watermark, countdown, version history, incoming list, closing the viewer on 404. Download is clicked on mocks. On sources: drive and share pages are `force-dynamic`, the token is not in `localStorage`, no `dangerouslySetInnerHTML`.

Unit API hits the same rules without a network, plus source invariants: a client `dto` is not passed to Prisma as a whole, FK/CHECK in migrations, storage is not called inside `$transaction`, listing does not walk the tree.

## What is not there

Playwright is not a drive matrix. There is a short smoke (auth, folder, upload, versions, public file link) plus `cto-break` (isolation, link scope, revoke vs signed GET, viewer vs editor, non-PDF, CSRF Origin). There are no browser scenarios for rename/move, nested folders, a public link to a folder or room, an invite to a new email, clicking “Download”, logout in a second tab. Chromium only.

Storage E2E always uses local disk. R2 is covered by unit tests with an SDK mock. Frontend Vitest does not open rename/move dialogs.

Isolation and sharing are in `apps/nestjs-backend/test/acl/` and `test/share/`.
