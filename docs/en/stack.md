# Stack

pnpm workspaces, Node.js 20+. Three packages: `web` (`apps/nextjs-frontend`), `api` (`apps/nestjs-backend`), `@sdr/shared` (`packages/shared`).

How the pieces talk to each other — [architecture](./architecture.md). How to run — [setup](./setup.md).

## Frontend

| | |
| --- | --- |
| Next.js 16 (App Router) | pages; no BFF, no Route Handlers |
| React 19 | UI |
| TypeScript | |
| Tailwind CSS 4 | styles |
| TanStack Query 5 | server state |
| Zustand 5 | theme, locale, drive UI — not server data |
| axios | HTTP, `withCredentials` |
| react-hook-form + Zod | forms; schemas from `@sdr/shared` |

## Backend

| | |
| --- | --- |
| NestJS 11 | REST and SSE |
| Prisma 7 | PostgreSQL access |
| Zod | request body (`ZodValidationPipe`), same schemas as the UI |
| bcryptjs | passwords |
| `@nestjs/throttler` | login, register, public-link resolve |
| AWS SDK for S3 | Cloudflare R2; locally — disk |

## Contract

`packages/shared`: Zod schemas for requests and responses. Both apps import `@sdr/shared`. A field change is made here, not copied in two apps.

## Data and files

| | |
| --- | --- |
| PostgreSQL 16 | users, tree, access, activity log. Locally — Docker (`postgres:16`) |
| Cloudflare R2 or local disk | PDF bytes. The database stores only `storage_key` |
| `pg_trgm` | substring search by name |

## Production

| | |
| --- | --- |
| Vercel | Next.js UI |
| Render | NestJS API and PostgreSQL |

## Tests

| | |
| --- | --- |
| Jest + Supertest | API unit and HTTP e2e |
| Vitest + Testing Library | UI screens on mocks |
| Playwright | browser, Chromium |
