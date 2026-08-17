# Стек

pnpm workspaces, Node.js 20+. Три пакети: `web` (`apps/nextjs-frontend`), `api` (`apps/nestjs-backend`), `@sdr/shared` (`packages/shared`).

Як частини пов’язані — [архітектура](./architecture.md). Як запустити — [setup](./setup.md).

## Фронтенд

| | |
| --- | --- |
| Next.js 16 (App Router) | сторінки; без BFF і Route Handlers |
| React 19 | UI |
| TypeScript | |
| Tailwind CSS 4 | стилі |
| TanStack Query 5 | стан із сервера |
| Zustand 5 | тема, локаль, UI диска — не серверні дані |
| axios | HTTP, `withCredentials` |
| react-hook-form + Zod | форми; схеми з `@sdr/shared` |

## Бекенд

| | |
| --- | --- |
| NestJS 11 | REST і SSE |
| Prisma 7 | доступ до PostgreSQL |
| Zod | тіло запиту (`ZodValidationPipe`), ті самі схеми, що в UI |
| bcryptjs | паролі |
| `@nestjs/throttler` | login, register, resolve публічного посилання |
| AWS SDK for S3 | Cloudflare R2; локально — диск |

## Контракт

`packages/shared`: Zod-схеми запитів і відповідей. Обидва додатки імпортують `@sdr/shared`. Поле API змінюють тут, не копіюють у двох додатках.

## Дані й файли

| | |
| --- | --- |
| PostgreSQL 16 | користувачі, дерево, доступи, журнал. Локально — Docker (`postgres:16`) |
| Cloudflare R2 або локальний диск | байти PDF. У базі лише `storage_key` |
| `pg_trgm` | пошук за підрядком імені |

## Прод

| | |
| --- | --- |
| Vercel | UI на Next.js |
| Render | NestJS API і PostgreSQL |

## Тести

| | |
| --- | --- |
| Jest + Supertest | unit API і HTTP e2e |
| Vitest + Testing Library | екрани UI на моках |
| Playwright | браузер, Chromium |
