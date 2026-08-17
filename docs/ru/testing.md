# Тесты

Права живут в Nest, не в Next. Поэтому основной объём — HTTP-тесты API. UI проверяется на моках; в браузере — короткий дым и проход по безопасности.

## Запуск

Из корня репозитория.

```bash
pnpm test              # unit API (Jest) + экраны UI (Vitest)
pnpm test:e2e          # HTTP Nest против PostgreSQL
pnpm test:e2e:web      # браузер (Playwright)
```

`pnpm test` сначала собирает `@sdr/shared` и генерирует Prisma Client (их нет в git). После `pnpm install` этого достаточно — `start.sh` заранее гонять не нужно.

Первый раз для Playwright: `pnpm --filter web exec playwright install chromium`.

`pnpm test:e2e` и `pnpm test:e2e:web` нельзя гонять одновременно: оба бьют `secure_data_room_test`. Рядом с `pnpm dev` Playwright можно — у него свои порты 4010 и 3100. Если прошлый прогон остановили Ctrl+C и следующий виснет или пишет, что порт занят: `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`; то же для `4010`.

## Слои

| Слой | Где | Чем | База |
| --- | --- | --- | --- |
| Unit API | `apps/nestjs-backend/src/**/*.spec.ts` | Jest, рядом с кодом | нет |
| E2E API | `apps/nestjs-backend/test/` | Jest + Supertest, настоящее Nest | PostgreSQL |
| Экраны UI | `apps/nextjs-frontend/test/` | Vitest + Testing Library | нет |
| Браузер | `apps/nextjs-frontend/e2e/` | Playwright, Chromium | та же test-БД |

В `packages/shared` отдельных тестов нет: схемы проверяются тем, что их используют API и формы.

E2E API поднимает Nest, чистит таблицы `TRUNCATE`, хранилище — локальный диск, не R2. Имена файлов (`AUTH-01`, `ACL-01`) — ярлыки; что именно смотрит сценарий, написано в комментарии в начале файла.

## Что проверено

**Изоляция и сессия** — чужая комната, папка, файл и signed URL дают `404` без metadata. Сессия только в httpOnly-cookie. CSRF по Origin, CORS не `*` с credentials, одинаковый `401` на неизвестный email и неверный пароль. Login, register и resolve публичной ссылки ограничены по частоте.

**Шаринг** — публичный токен случайный, в базе hash, ссылка не шире цели. Грант, инвайт (accept при регистрации), overlapping grants (узкий затем широкий; покрытый потомок — `409 already_covered`), move из/в shared-папку, revoke, срок `expires_at`. После revoke новые download URL не выдаются; уже выданный signed GET живёт до TTL. Удаление цели закрывает её ссылки и гранты.

**Диск** — ключ объекта собирает сервер, имя файла на путь не влияет, только PDF, размер с тела запроса. Повторная загрузка того же имени — новая версия, не вторая строка; viewer версию не добавляет, editor — да; удаление снимает все блобы версий. Уникальность имён и «ребёнок из той же комнаты» — ограничения PostgreSQL. Гонки create/rename/move/delete. Удаление поддерева сразу `404`, повторный DELETE не 500.

**Поиск** — `GET /search` с ACL (ACL-16): владелец, покрывающий грант или цель публичной ссылки. Маски в `q` не совпадают со всеми именами. Вложенные файлы находятся; listing по-прежнему отдаёт только прямых детей (PERF-09).

**Live и журнал** — SSE (handshake, grant, revoke, delete, публичная ссылка; чужой dataRoomId события не получает) и activity на API: просмотр пишется с POST, не с GET, скачивание — каждый клик, дашборд только владельцу, гость без токена в записи. В браузере — закрытие PDF после revoke и после выключения ссылки, закрытие shared-папки после delete, «Гость по ссылке» в журнале владельца.

**UI** — формы, очередь загрузки, watermark, countdown, история версий, входящие, закрытие viewer по 404. Download нажимается на моках. На исходниках: страницы drive и share — `force-dynamic`, токен не в `localStorage`, нет `dangerouslySetInnerHTML`.

Unit API бьёт те же правила без сети, плюс инварианты по исходникам: клиентский `dto` не уходит в Prisma целиком, FK/CHECK в миграциях, вызов хранилища не внутри `$transaction`, listing без обхода дерева.

## Чего нет

Playwright — не матрица диска. Короткий дым (auth, папка, upload, версии, публичная ссылка на файл) и `cto-break` (изоляция, scope ссылки, revoke vs signed GET, viewer vs editor, не-PDF, CSRF Origin). Нет сценариев rename/move, вложенных папок, ссылки на папку или комнату, инвайта на новый email, нажатия «Скачать», logout во второй вкладке. Только Chromium.

E2E хранилища всегда на локальном диске. R2 покрыт unit с моком SDK. Диалоги rename/move на фронте Vitest не открывает.

Изоляция и шаринг — в `apps/nestjs-backend/test/acl/` и `test/share/`.
