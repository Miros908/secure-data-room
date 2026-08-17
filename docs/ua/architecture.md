# Архітектура

Браузер ходить у NestJS (`NEXT_PUBLIC_API_URL`, cookie `session`). Next.js не перевіряє права: межа довіри — API. JSON і SSE локально йдуть на API, у проді — на same-origin `/backend` (rewrite на Render), щоб cookie була first-party. Байти PDF — на хост API з коротким upload-ticket: через Vercel вони не їдуть. PostgreSQL зберігає метадані, дерево, доступи й журнал. Байти PDF — у R2 або на диску. Назовні файл віддається тимчасовим підписаним посиланням, не постійним URL.

Монорепозиторій: `apps/nextjs-frontend`, `apps/nestjs-backend`, контракт `@sdr/shared`. Бібліотеки й версії — [стек](./stack.md).

Прод: Next.js на Vercel; NestJS API і PostgreSQL на Render.


## Принципи

1. **API рахує права на кожен запит.** UI не джерело істини. `ResolveService`: власник, покривний грант або публічний токен. Немає доступу → `404` (чуже невідрізненне від неіснуючого). Бачить, але не може писати → `403`. Клієнт не передає `ownerId` і `storage_key`.
2. **PostgreSQL — джерело істини для файла.** Немає рядка — файла в застосунку немає. Сирота в бакеті можлива, у listing її немає.
3. **Права не копіюються на кожен файл.** Грант на кімнату або папку покриває нащадків за `path`.
4. **Покрите предком не видаємо ще раз.** Якщо в людини вже є активний грант або pending-інвайт на кімнату чи папку, вузький грант на файл або вкладену папку всередині не створюється — `409 already_covered`. Спочатку вузький, потім широкий — можна: відкликання широкого не знімає вузький. Публічні посилання цю перевірку не роблять.
5. **Немає постійного URL об’єкта.** Після ACL backend видає посилання ~15 хвилин. Revoke ріже нові видачі; уже видане посилання живе до TTL.
6. **Тривалі операції поза транзакцією БД:** bcrypt, `storage.put` / `storage.delete`, signed URL. `$transaction` лише для Postgres (`maxWait` 2s, `timeout` 5s).

## Як влаштовано

Сторінки дергають axios-клієнт, відповіді перевіряються Zod із `@sdr/shared`. BFF і Next.js Route Handlers немає: `/backend` у проді — rewrite, UI сесію не читає. Глобальні `SessionGuard` і `CsrfOriginGuard`. `@Public()` сесію не вимагає, але підставляє користувача, якщо cookie є.

Завантаження: `POST /files/upload-ticket` (сесія), потім `POST /files` (cookie або `X-Upload-Ticket`) → write → `storage.put` → рядок файла або нова версія в Postgres. Читання: `GET /files/:id` (cookie і/або `?token=`) → read → `downloadUrl`. Версії: `GET /files/:id/versions` і `.../:versionId`. Браузер відкриває PDF за signed GET у R2 або `GET /storage/objects` (локальний драйвер).

**Пошук.** `GET /search?q=&dataRoomId=` (опційно `?token=` і cursor). Підрядок в імені файла і папки, лише в тому, що викликач уже може читати: власник, покривні гранти або ціль публічного посилання. Це не listing і не обхід дерева в API. PostgreSQL `ILIKE` з екрануванням `%` / `_` і індекси `pg_trgm`. Keyset за `(name, kind, id)`. Хіти — навігація; мутації лишаються в listing.

**Диск.** Одна кімната на власника (`data_rooms.owner_id` унікальний), створюється під час реєстрації. Папки: `parent_id` для дітей, `path` з UUID (`/id/id/`) без імен — rename не чіпає піддерево. Папки не переміщуються: інакше довелося б переписувати `path` у нащадків. Глибина — 32 рівні, `path` до 2048 символів. Файл і папка прив’язані до кімнати складеним FK: вузол не можна повісити на батька з іншої кімнати. Файл рухається лише всередині кімнати.

Ключ об’єкта збирає лише сервер: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. Ім’я в ключ не входить: rename і move змінюють Postgres, об’єкт не копіюється. Upload того самого імені в ту саму папку (є write) — нова версія того самого `file.id`. Конфлікт імені папки, rename або move → `409 name_taken`. Унікальність папок і файлів роздільна.

**Доступ.** Грант на кімнату, папку або файл (`viewer` / `editor`), рівно одна ціль. Писати — власник і editor; шарити — лише власник. Не можна видати доступ собі або власнику. Публічне посилання завжди viewer. Одночасно активні один грант на пару (користувач, ціль) і одне публічне посилання на ціль. Повторний грант через цей API роль не підвищує; accept інвайту, якщо грант уже є, може підняти `viewer` → `editor`. Відкликання — `revoked_at`, не DELETE.

Покриття: кімната — увесь вміст; папка — вона і нащадки. Перетин грантів — принцип 4. Кілька грантів складаються за максимумом ролі. Хлібні крихти показують лише предків, на яких є роль. Грант на один файл не відкриває батька і сусідів: такі вузли у вхідних шарах, не як чужий диск. У «спільних кімнатах» — лише гранти на всю кімнату. Зняти успадкований доступ — відкликати його на тому предку, де він виданий.

Якщо email ще не зареєстрований — запрошення: токен у URL, SHA-256 у базі, 7 днів. Саме запрошення доступу не дає; під час логіну або реєстрації pending-інвайти приймаються.

**Живість і журнал.** `GET /events` (SSE): після commit revoke/delete сервер пушить подію, клієнт перезапитує REST. Джерело прав — усе одно `ResolveService`. Реєстр з’єднань у пам’яті процесу.

Журнал `activity_events` append-only, без FK на файл/папку, ім’я в `resource_name` — історія живе після delete. Читає лише власник (`GET /data-rooms/:id/activity`). Live-подія `activity_recorded` оновлює відкриту стрічку.

## Рішення

| Зробили | Навіщо | Ціна |
| --- | --- | --- |
| Одна кімната на `owner_id` | простий корінь ACL для MVP | не можна кілька дисків |
| `path` з UUID, не з імен | rename не переписує піддерево | папки не можна переміщувати |
| Ім’я не в storage key | rename/move без копіювання об’єкта | ключ знає лише сервер |
| Upload того самого імені = версія | немає мовчазного перезапису і `file (1).pdf` | listing — один рядок |
| ACL за `path` у момент запиту | не копіювати права на кожен файл | немає винятків із папки |
| Відкликання = `revoked_at` | історія + унікальність лише активних | таблиця росте |
| SSE в пам’яті процесу | просто для одного інстанса | кілька replica без Redis можуть не доставити push |
| Signed URL ~15 хв | бакет закритий, немає постійного URL | revoke не гасить уже видане посилання |

## Два сховища

Postgres і object storage не в одній транзакції.

**Upload:** `storage.put`, потім транзакція Postgres (`files` + `file_versions` + `current_version_id`). Помилка транзакції → компенсувальний `storage.delete`. Якщо й delete впав — сирота в бакеті, у listing файла немає.

**Delete:** ключі версій знімаються **до** `DELETE` (інакше CASCADE стер би `file_versions`). Потім транзакція Postgres: каскадом гранти й посилання, журнал у тій самій транзакції. Після commit — best-effort `storage.delete`. Помилка сховища не відкочує Postgres.

**Гонки.** Два одночасних upload одного імені → `P2002` обробляється як нова версія того самого `file.id`. Create / rename / move при зайнятому імені → `409`. Move в уже видалену папку (`P2003`) → `404`. Паралельний rename — last-write-wins. Foreign keys не залишають висячий `parent_id`. Реєстрація: користувач, сесія і кімната в одній транзакції; accept інвайту після — помилка інвайту не відкочує обліковий запис. Якщо кімната для власника вже є (`P2002`), береться наявна.

## Обмеження

Чого немає в продукті — [README](./README.md). Signed URL після revoke, CSRF без Origin — [безпека](./security.md). Listing, пошук і replica — [як масштабується](./how-it-scales.md).

Що специфічно для цієї сторінки:

- Однакове ім’я в папки й файла в одному каталозі теоретично можливе.
- Старі ключі `{prefix}/{dataRoomId}/{fileId}` у вже лежачих файлів не переписуються.

## Де код

Фронт: `page.tsx` → UI екрана → хук → `app/api` → axios. Сторінка axios не викликає. Компонент екрана не імпортує `api/*`.

Бек: контролер → сервіс однієї операції → репозиторій Prisma.

Контракт запитів і відповідей — Zod у `packages/shared` (`@sdr/shared`). Обидва застосунки імпортують одні схеми.

### Frontend — `apps/nextjs-frontend/src`

```
app/
├── layout.tsx                 # кореневий layout: шрифти, провайдери
├── page.tsx                   # лендінг /
├── globals.css
├── (pages)/                   # дужки в URL не потрапляють
│   ├── login/                 # /login
│   ├── register/              # /register
│   ├── drive/                 # /drive — свій диск, шари, журнал
│   └── share/                 # /share — вхід за публічним посиланням, не всередині drive
│       └── components/        # UI лише цього екрана (у login/register/drive так само)
├── hooks/
│   ├── queries/               # TanStack Query: me, папка, файл, шари, журнал
│   ├── mutations/             # login, upload, rename, share, revoke…
│   ├── use-live-access.tsx    # SSE: відкликання й видалення на відкритій вкладці
│   └── use-live-notice.tsx    # тост за live-подією
├── api/                       # один файл на ендпоінт: axios + zod
│                              # *.fetcher.ts — GET, *.poster.ts — мутації
│                              # це не Next Route Handlers, route.ts тут немає
├── lib/                       # query-keys, URL SSE, тексти live-подій
└── components/                # спільне для кількох екранів: оболонка логіну,
                               # вибір строку доступу, історія версій, PDF watermark
components/                    # примітиви всього застосунку: кнопка, діалог, тема, тост
infrastructure/http/           # axios-інстанс (withCredentials) і розбір помилок API
providers/                     # QueryClient, тема
store/                         # Zustand: тема, вигляд диска, тости — лише те, чого немає на сервері
lib/                           # тексти помилок API, cx
```

`(pages)` — не модуль. Без дужок адреса була б `/pages/login`. Share — окремий вхід: гість за токеном не повинен жити всередині `/drive`.

| Що | Куди |
| --- | --- |
| UI одного екрана | `app/(pages)/<сторінка>/components/` |
| Хук або запит на 2+ сторінки | `app/hooks`, `app/api` |
| Оболонка 2+ сторінок | `app/components` |
| Кнопка, інпут, тема | `src/components` |
| Ключі кешу Query | `app/lib/<фіча>.query-keys.ts` |

### Backend — `apps/nestjs-backend/src`

Один модуль = одна область. Усередині завжди одна схема:

```
files/
├── files.controller.ts        # HTTP: шлях, пайпи, guards
├── files.module.ts
├── files.repository.ts        # Prisma, без бізнес-логіки
├── files.constants.ts
├── services/                  # одна операція — один файл
│   ├── upload-file.service.ts
│   ├── get-file.service.ts
│   └── …
└── utils/
```

Контролер не ходить у Prisma і не рахує ACL: викликає сервіс. Сервіс кличе `ResolveService` і репозиторій.

```
modules/
├── auth/                      # реєстрація, login, logout, me
│                              # SessionGuard, CsrfOriginGuard, @Public(), cookie
├── data-rooms/                # одна кімната на власника: створити, отримати, список
├── folders/                   # дерево: створити, вміст, rename, delete
├── files/                     # upload, get, версії, move, rename, delete
├── search/                    # GET /search — ім’я по кімнаті, ACL у SQL
├── access/                    # гранти, інвайти, публічні посилання, revoke
│                              # ResolveService — роль на кімнату/папку/файл
├── activity/                  # журнал: запис перегляду/завантаження, зведення, стрічка
└── events/                    # GET /events — SSE, брокер з’єднань у пам’яті
infrastructure/storage/        # драйвер: local (GET /storage/objects) або R2
│   ├── storage.service.ts     # put / delete / signed URL
│   ├── storage-key.ts         # {prefix}/{room}/{file}/{version}
│   ├── local/
│   └── r2/
database/                      # PrismaService, транзакції, мапінг помилок Prisma
main.ts                        # CORS, cookie, глобальні guard/filter/pipe
app.module.ts
```

Схема таблиць — `apps/nestjs-backend/prisma/schema.prisma`, не в `src`.

### Контракт — `packages/shared/src`

```
auth/          # login, register, me, user
files/         # upload, file, версії
folders/
data-rooms/
access/        # грант, інвайт, публічне посилання, incoming/outgoing
activity/
search/        # GET /search запит і хіти
events/        # форма live-події SSE
http/          # форма помилки API
```

Фронт перевіряє відповідь цими схемами. Бек — тіло запиту (`ZodValidationPipe`). Змінювати поле в API — тут, а не копіювати тип у двох застосунках.
