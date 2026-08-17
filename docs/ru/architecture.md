# Архитектура

Браузер ходит в NestJS (`NEXT_PUBLIC_API_URL`, cookie `session`). Next.js не проверяет права: граница доверия — API. JSON и SSE локально идут на API, в проде — на same-origin `/backend` (rewrite на Render), чтобы cookie была first-party. Байты PDF — на хост API с коротким upload-ticket: через Vercel они не едут. PostgreSQL хранит метаданные, дерево, доступы и журнал. Байты PDF — в R2 или на диске. Наружу файл отдаётся временной подписанной ссылкой, не постоянным URL.

Монорепозиторий: `apps/nextjs-frontend`, `apps/nestjs-backend`, контракт `@sdr/shared`. Библиотеки и версии — [стек](./stack.md).

Прод: Next.js на Vercel; NestJS API и PostgreSQL на Render.


## Принципы

1. **API считает права на каждый запрос.** UI не источник истины. `ResolveService`: владелец, покрывающий грант или публичный токен. Нет доступа → `404` (чужое неотличимо от несуществующего). Видит, но не может писать → `403`. Клиент не передаёт `ownerId` и `storage_key`.
2. **PostgreSQL — источник истины для файла.** Нет строки — файла в приложении нет. Сирота в бакете возможна, в listing её нет.
3. **Права не копируются на каждый файл.** Грант на комнату или папку покрывает потомков по `path`.
4. **Покрытое предком не выдаём ещё раз.** Если у человека уже есть активный грант или pending-инвайт на комнату или папку, узкий грант на файл или вложенную папку внутри не создаётся — `409 already_covered`. Сначала узкий, потом широкий — можно: отзыв широкого не снимает узкий. Публичные ссылки эту проверку не делают.
5. **Нет постоянного URL объекта.** После ACL backend выдаёт ссылку ~15 минут. Revoke режет новые выдачи; уже выданная ссылка живёт до TTL.
6. **Долгие операции вне транзакции БД:** bcrypt, `storage.put` / `storage.delete`, signed URL. `$transaction` только для Postgres (`maxWait` 2s, `timeout` 5s).

## Как устроено

Страницы дергают axios-клиент, ответы проверяются Zod из `@sdr/shared`. BFF и Next.js Route Handlers нет: `/backend` в проде — rewrite, UI сессию не читает. Глобальные `SessionGuard` и `CsrfOriginGuard`. `@Public()` сессию не требует, но подставляет пользователя, если cookie есть.

Загрузка: `POST /files/upload-ticket` (сессия), затем `POST /files` (cookie или `X-Upload-Ticket`) → write → `storage.put` → строка файла или новая версия в Postgres. Чтение: `GET /files/:id` (cookie и/или `?token=`) → read → `downloadUrl`. Версии: `GET /files/:id/versions` и `.../:versionId`. Браузер открывает PDF по signed GET в R2 или `GET /storage/objects` (локальный драйвер).

**Поиск.** `GET /search?q=&dataRoomId=` (опционально `?token=` и cursor). Подстрока в имени файла и папки, только в том, что вызывающий уже может читать: владелец, покрывающие гранты или цель публичной ссылки. Это не listing и не обход дерева в API. PostgreSQL `ILIKE` с экранированием `%` / `_` и индексы `pg_trgm`. Keyset по `(name, kind, id)`. Хиты — навигация; мутации остаются в listing.

**Диск.** Одна комната на владельца (`data_rooms.owner_id` уникален), создаётся при регистрации. Папки: `parent_id` для детей, `path` из UUID (`/id/id/`) без имён — rename не трогает поддерево. Папки не перемещаются: иначе пришлось бы переписывать `path` у потомков. Глубина — 32 уровня, `path` до 2048 символов. Файл и папка привязаны к комнате составным FK: узел нельзя повесить на родителя из другой комнаты. Файл двигается только внутри комнаты.

Ключ объекта собирает только сервер: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. Имя в ключ не входит: rename и move меняют Postgres, объект не копируется. Upload того же имени в ту же папку (есть write) — новая версия того же `file.id`. Конфликт имени папки, rename или move → `409 name_taken`. Уникальность папок и файлов раздельная.

**Доступ.** Грант на комнату, папку или файл (`viewer` / `editor`), ровно одна цель. Писать — владелец и editor; шарить — только владелец. Нельзя выдать доступ себе или владельцу. Публичная ссылка всегда viewer. Одновременно активны один грант на пару (пользователь, цель) и одна публичная ссылка на цель. Повторный грант через этот API роль не повышает; accept инвайта, если грант уже есть, может поднять `viewer` → `editor`. Отзыв — `revoked_at`, не DELETE.

Покрытие: комната — всё содержимое; папка — она и потомки. Пересечение грантов — принцип 4. Несколько грантов складываются по максимуму роли. Хлебные крошки показывают только предков, на которых есть роль. Грант на один файл не открывает родителя и соседей: такие узлы во входящих шарах, не как чужой диск. В «общих комнатах» — только гранты на всю комнату. Снять унаследованный доступ — отозвать его на том предке, где он выдан.

Если email ещё не зарегистрирован — приглашение: токен в URL, SHA-256 в базе, 7 дней. Само приглашение доступа не даёт; при логине или регистрации pending-инвайты принимаются.

**Живость и журнал.** `GET /events` (SSE): после commit revoke/delete сервер пушит событие, клиент переспрашивает REST. Источник прав — всё равно `ResolveService`. Реестр соединений в памяти процесса.

Журнал `activity_events` append-only, без FK на файл/папку, имя в `resource_name` — история живёт после delete. Читает только владелец (`GET /data-rooms/:id/activity`). Live-событие `activity_recorded` обновляет открытую ленту.

## Решения

| Сделали | Зачем | Цена |
| --- | --- | --- |
| Одна комната на `owner_id` | простой корень ACL для MVP | нельзя несколько дисков |
| `path` из UUID, не из имён | rename не переписывает поддерево | папки нельзя перемещать |
| Имя не в storage key | rename/move без копирования объекта | ключ знает только сервер |
| Upload того же имени = версия | нет молчаливой перезаписи и `file (1).pdf` | listing — одна строка |
| ACL по `path` в момент запроса | не копировать права на каждый файл | нет исключений из папки |
| Отзыв = `revoked_at` | история + уникальность только активных | таблица растёт |
| SSE в памяти процесса | просто для одного инстанса | несколько replica без Redis могут не доставить push |
| Signed URL ~15 мин | бакет закрыт, нет постоянного URL | revoke не гасит уже выданную ссылку |

## Два хранилища

Postgres и object storage не в одной транзакции.

**Upload:** `storage.put`, затем транзакция Postgres (`files` + `file_versions` + `current_version_id`). Ошибка транзакции → компенсирующий `storage.delete`. Если и delete упал — сирота в бакете, в listing файла нет.

**Delete:** ключи версий снимаются **до** `DELETE` (иначе CASCADE стер бы `file_versions`). Затем транзакция Postgres: каскадом гранты и ссылки, журнал в той же транзакции. После commit — best-effort `storage.delete`. Ошибка хранилища не откатывает Postgres.

**Гонки.** Два одновременных upload одного имени → `P2002` обрабатывается как новая версия того же `file.id`. Create / rename / move при занятом имени → `409`. Move в уже удалённую папку (`P2003`) → `404`. Параллельный rename — last-write-wins. Foreign keys не оставляют висячий `parent_id`. Регистрация: пользователь, сессия и комната в одной транзакции; accept инвайта после — ошибка инвайта не откатывает аккаунт. Если комната для владельца уже есть (`P2002`), берётся существующая.

## Ограничения

Чего нет в продукте — [README](./README.md). Signed URL после revoke, CSRF без Origin — [безопасность](./security.md). Listing, поиск и replica — [как масштабируется](./how-it-scales.md).

Что специфично для этой страницы:

- Одинаковое имя у папки и файла в одном каталоге теоретически возможно.
- Старые ключи `{prefix}/{dataRoomId}/{fileId}` у уже лежащих файлов не переписываются.

## Где код

Фронт: `page.tsx` → UI экрана → хук → `app/api` → axios. Страница axios не вызывает. Компонент экрана не импортирует `api/*`.

Бэк: контроллер → сервис одной операции → репозиторий Prisma.

Контракт запросов и ответов — Zod в `packages/shared` (`@sdr/shared`). Оба приложения импортируют одни схемы.

### Frontend — `apps/nextjs-frontend/src`

```
app/
├── layout.tsx                 # корневой layout: шрифты, провайдеры
├── page.tsx                   # лендинг /
├── globals.css
├── (pages)/                   # скобки в URL не попадают
│   ├── login/                 # /login
│   ├── register/              # /register
│   ├── drive/                 # /drive — свой диск, шары, журнал
│   └── share/                 # /share — вход по публичной ссылке, не внутри drive
│       └── components/        # UI только этого экрана (у login/register/drive так же)
├── hooks/
│   ├── queries/               # TanStack Query: me, папка, файл, шары, журнал
│   ├── mutations/             # login, upload, rename, share, revoke…
│   ├── use-live-access.tsx    # SSE: отзыв и удаление на открытой вкладке
│   └── use-live-notice.tsx    # тост по live-событию
├── api/                       # один файл на эндпоинт: axios + zod
│                              # *.fetcher.ts — GET, *.poster.ts — мутации
│                              # это не Next Route Handlers, route.ts здесь нет
├── lib/                       # query-keys, URL SSE, тексты live-событий
└── components/                # общее для нескольких экранов: оболочка логина,
                               # выбор срока доступа, история версий, PDF watermark
components/                    # примитивы всего приложения: кнопка, диалог, тема, тост
infrastructure/http/           # axios-инстанс (withCredentials) и разбор ошибок API
providers/                     # QueryClient, тема
store/                         # Zustand: тема, вид диска, тосты — только то, чего нет на сервере
lib/                           # тексты ошибок API, cx
```

`(pages)` — не модуль. Без скобок адрес был бы `/pages/login`. Share — отдельный вход: гость по токену не должен жить внутри `/drive`.

| Что | Куда |
| --- | --- |
| UI одного экрана | `app/(pages)/<страница>/components/` |
| Хук или запрос на 2+ страницы | `app/hooks`, `app/api` |
| Оболочка 2+ страниц | `app/components` |
| Кнопка, инпут, тема | `src/components` |
| Ключи кеша Query | `app/lib/<фича>.query-keys.ts` |

### Backend — `apps/nestjs-backend/src`

Один модуль = одна область. Внутри всегда одна схема:

```
files/
├── files.controller.ts        # HTTP: путь, пайпы, guards
├── files.module.ts
├── files.repository.ts        # Prisma, без бизнес-логики
├── files.constants.ts
├── services/                  # одна операция — один файл
│   ├── upload-file.service.ts
│   ├── get-file.service.ts
│   └── …
└── utils/
```

Контроллер не ходит в Prisma и не считает ACL: вызывает сервис. Сервис зовёт `ResolveService` и репозиторий.

```
modules/
├── auth/                      # регистрация, login, logout, me
│                              # SessionGuard, CsrfOriginGuard, @Public(), cookie
├── data-rooms/                # одна комната на владельца: создать, получить, список
├── folders/                   # дерево: создать, содержимое, rename, delete
├── files/                     # upload, get, версии, move, rename, delete
├── search/                    # GET /search — имя по комнате, ACL в SQL
├── access/                    # гранты, инвайты, публичные ссылки, revoke
│                              # ResolveService — роль на комнату/папку/файл
├── activity/                  # журнал: запись просмотра/скачивания, сводка, лента
└── events/                    # GET /events — SSE, брокер соединений в памяти
infrastructure/storage/        # драйвер: local (GET /storage/objects) или R2
│   ├── storage.service.ts     # put / delete / signed URL
│   ├── storage-key.ts         # {prefix}/{room}/{file}/{version}
│   ├── local/
│   └── r2/
database/                      # PrismaService, транзакции, маппинг ошибок Prisma
main.ts                        # CORS, cookie, глобальные guard/filter/pipe
app.module.ts
```

Схема таблиц — `apps/nestjs-backend/prisma/schema.prisma`, не в `src`.

### Контракт — `packages/shared/src`

```
auth/          # login, register, me, user
files/         # upload, file, версии
folders/
data-rooms/
access/        # грант, инвайт, публичная ссылка, incoming/outgoing
activity/
search/        # GET /search запрос и хиты
events/        # форма live-события SSE
http/          # форма ошибки API
```

Фронт проверяет ответ этими схемами. Бэк — тело запроса (`ZodValidationPipe`). Менять поле в API — здесь, а не копировать тип в двух приложениях.
