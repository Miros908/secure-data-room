# Тести

Права живуть у Nest, не в Next. Тому основний обсяг — HTTP-тести API. UI перевіряється на моках; у браузері — короткий дим і прохід по безпеці.

## Запуск

Із кореня репозиторію.

```bash
pnpm test              # unit API (Jest) + екрани UI (Vitest)
pnpm test:e2e          # HTTP Nest проти PostgreSQL
pnpm test:e2e:web      # браузер (Playwright)
```

`pnpm test` спочатку збирає `@sdr/shared` і генерує Prisma Client (їх немає в git). Після `pnpm install` цього досить — `start.sh` наперед ганяти не потрібно.

Перший раз для Playwright: `pnpm --filter web exec playwright install chromium`.

`pnpm test:e2e` і `pnpm test:e2e:web` не можна ганяти одночасно: обидва б’ють `secure_data_room_test`. Поруч із `pnpm dev` Playwright можна — у нього свої порти 4010 і 3100. Якщо попередній прогін зупинили Ctrl+C і наступний висне або каже, що порт зайнятий: `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`; те саме для `4010`.

## Шари

| Шар | Де | Чим | База |
| --- | --- | --- | --- |
| Unit API | `apps/nestjs-backend/src/**/*.spec.ts` | Jest, поруч із кодом | немає |
| E2E API | `apps/nestjs-backend/test/` | Jest + Supertest, справжній Nest | PostgreSQL |
| Екрани UI | `apps/nextjs-frontend/test/` | Vitest + Testing Library | немає |
| Браузер | `apps/nextjs-frontend/e2e/` | Playwright, Chromium | та сама test-БД |

У `packages/shared` окремих тестів немає: схеми перевіряються тим, що їх використовують API і форми.

E2E API піднімає Nest, чистить таблиці `TRUNCATE`, сховище — локальний диск, не R2. Імена файлів (`AUTH-01`, `ACL-01`) — ярлики; що саме дивиться сценарій, написано в коментарі на початку файла.

## Що перевірено

**Ізоляція і сесія** — чужа кімната, папка, файл і signed URL дають `404` без metadata. Сесія лише в httpOnly-cookie. CSRF за Origin, CORS не `*` з credentials, однаковий `401` на невідомий email і невірний пароль. Login, register і resolve публічного посилання обмежені за частотою.

**Шаринг** — публічний токен випадковий, у базі hash, посилання не ширше за ціль. Грант, інвайт (accept при реєстрації), overlapping grants (вузький потім широкий; покритий нащадок — `409 already_covered`), move з/у shared-папку, revoke, строк `expires_at`. Після revoke нові download URL не видаються; уже виданий signed GET живе до TTL. Видалення цілі закриває її посилання і гранти.

**Диск** — ключ об’єкта збирає сервер, ім’я файла на шлях не впливає, лише PDF, розмір із тіла запиту. Повторне завантаження того самого імені — нова версія, не другий рядок; viewer версію не додає, editor — так; видалення знімає всі блоби версій. Унікальність імен і «дитина з тієї самої кімнати» — обмеження PostgreSQL. Гонки create/rename/move/delete. Видалення піддерева одразу `404`, повторний DELETE не 500.

**Пошук** — `GET /search` з ACL (ACL-16): власник, покривний грант або ціль публічного посилання. Маски в `q` не збігаються з усіма іменами. Вкладені файли знаходяться; listing і далі віддає лише прямих дітей (PERF-09).

**Live і журнал** — SSE (handshake, grant, revoke, delete, публічне посилання; чужий dataRoomId події не отримує) і activity на API: перегляд пишеться з POST, не з GET, завантаження — кожен клік, дашборд лише власнику, гість без токена в записі. У браузері — закриття PDF після revoke і після вимкнення посилання, закриття shared-папки після delete, «Гість за посиланням» у журналі власника.

**UI** — форми, черга завантаження, watermark, countdown, історія версій, вхідні, закриття viewer по 404. Download натискається на моках. На вихідниках: сторінки drive і share — `force-dynamic`, токен не в `localStorage`, немає `dangerouslySetInnerHTML`.

Unit API б’є ті самі правила без мережі, плюс інваріанти за вихідниками: клієнтський `dto` не йде в Prisma цілком, FK/CHECK у міграціях, виклик сховища не всередині `$transaction`, listing без обходу дерева.

## Чого немає

Playwright — не матриця диска. Короткий дим (auth, папка, upload, версії, публічне посилання на файл) і `cto-break` (ізоляція, scope посилання, revoke vs signed GET, viewer vs editor, не-PDF, CSRF Origin). Немає сценаріїв rename/move, вкладених папок, посилання на папку або кімнату, інвайту на новий email, натискання «Завантажити», logout у другій вкладці. Лише Chromium.

E2E сховища завжди на локальному диску. R2 покритий unit з моком SDK. Діалоги rename/move на фронті Vitest не відкриває.

Ізоляція і шаринг — у `apps/nestjs-backend/test/acl/` і `test/share/`.
