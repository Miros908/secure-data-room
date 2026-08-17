# Стек

pnpm workspaces, Node.js 20+. Три пакета: `web` (`apps/nextjs-frontend`), `api` (`apps/nestjs-backend`), `@sdr/shared` (`packages/shared`).

Как части связаны — [архитектура](./architecture.md). Как запустить — [setup](./setup.md).

## Фронтенд

| | |
| --- | --- |
| Next.js 16 (App Router) | страницы; без BFF и Route Handlers |
| React 19 | UI |
| TypeScript | |
| Tailwind CSS 4 | стили |
| TanStack Query 5 | состояние с сервера |
| Zustand 5 | тема, локаль, UI диска — не серверные данные |
| axios | HTTP, `withCredentials` |
| react-hook-form + Zod | формы; схемы из `@sdr/shared` |

## Бэкенд

| | |
| --- | --- |
| NestJS 11 | REST и SSE |
| Prisma 7 | доступ к PostgreSQL |
| Zod | тело запроса (`ZodValidationPipe`), те же схемы, что у UI |
| bcryptjs | пароли |
| `@nestjs/throttler` | login, register, resolve публичной ссылки |
| AWS SDK for S3 | Cloudflare R2; локально — диск |

## Контракт

`packages/shared`: Zod-схемы запросов и ответов. Оба приложения импортируют `@sdr/shared`. Поле API меняют здесь, не копируют в двух приложениях.

## Данные и файлы

| | |
| --- | --- |
| PostgreSQL 16 | пользователи, дерево, доступы, журнал. Локально — Docker (`postgres:16`) |
| Cloudflare R2 или локальный диск | байты PDF. В базе только `storage_key` |
| `pg_trgm` | поиск по подстроке имени |

## Прод

| | |
| --- | --- |
| Vercel | UI на Next.js |
| Render | NestJS API и PostgreSQL |

## Тесты

| | |
| --- | --- |
| Jest + Supertest | unit API и HTTP e2e |
| Vitest + Testing Library | экраны UI на моках |
| Playwright | браузер, Chromium |
