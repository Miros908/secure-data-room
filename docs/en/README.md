# Data Room

An app for exchanging and sharing files. Files sit in nested folders; they can be shared with a public link or a specific person, with an optional expiry, and access can be revoked. The owner can see who viewed and downloaded the files.

## Hosted

- Frontend (Vercel): https://deal-box.vercel.app
- Backend API (Render): https://secure-data-room.onrender.com
- PostgreSQL is also deployed on Render, next to the API. There is no public database URL.

## Test accounts (reviewer)

For the hosted app at [deal-box.vercel.app](https://deal-box.vercel.app):

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner-test@gmail.com` | `12345678` |
| Viewer | `viewer-test@gmail.com` | `12345678` |

- [Setup](./setup.md)
- [Stack](./stack.md)
- [Architecture](./architecture.md)
- [Security](./security.md)
- [Database](./database.md)
- [How it scales](./how-it-scales.md)
- [Tests](./testing.md)
- [AI usage](#ai-usage)

## Features

- [x] Registration and login with email and password
- [x] Isolation of data rooms belonging to different users
- [x] Nested folders, breadcrumbs, rename and delete
- [x] Upload of multiple files with progress, in-app preview
- [x] Rename, move, and delete files
- [x] Versions: re-uploading the same name into the same folder does not create a duplicate
- [x] Public link and access for a specific user, including with an expiry
- [x] Access revoke
- [x] Live update of open tabs on revoke, access expiry, and delete
- [x] Owner activity log: views, downloads, link opens, grants and revokes, deletes
- [x] Search by file and folder name across a Data Room (backend, with the same ACL as listing)

## Stack

pnpm monorepo: Next.js 16 and React 19 on the frontend, NestJS 11 API, PostgreSQL 16 and Prisma 7, files on disk or in Cloudflare R2. Production: UI on Vercel; API and PostgreSQL on Render.

Libraries and versions — [stack](./stack.md).

## AI usage

AI was used in the project as a tool to speed up development, not as a replacement for engineering design and decision-making. The application architecture, data model, module boundaries, authorization rules, data-integrity requirements, and the main technical decisions were designed and reviewed by me by hand.

The main workflow was as follows: first a concrete implementation plan for the task was formed, with expected behavior, constraints, and the parts of the system that would be affected. After a manual review and adjustment of the plan, implementation of individual, mostly routine tasks was delegated to Cursor using Composer 2.5. The resulting code then went through a manual check for fit with the architecture, the project's business logic, and expected edge cases.

The stronger Opus 5 model was used separately as an extra review layer: for refactoring, finding potential defects, analyzing complex parts of the code, checking for architectural-boundary violations, duplication, and possible security issues. Thus AI was used in several roles — as an executor of predefined tasks and as an additional code-review tool — while final responsibility for the architecture, correctness of the logic, and the technical decisions taken remained with me.

## Not implemented

- Full-text search inside file contents
- One search across every shared room at once (incoming shares stay a separate list)
- Server-side search in activity, incoming, and outgoing views (those still filter the already loaded page)
- Search filters by date, size, or type
- Folder move
- Several Data Rooms per owner
- Google sign-in, email verification, password reset
- Pagination of folder listing
- ACL exceptions (“everything in the folder except this file”)
- Background workers, thumbnails, export
- Redis so SSE reaches every API replica
- Garbage collection of orphan blobs
- Retention policy for old file versions and the activity log
