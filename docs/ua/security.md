# Безпека

Межа довіри — **NestJS API**. Next.js не перевіряє сесію в middleware і не читає cookie: якщо обійти UI, правила ті самі — cookie або upload-ticket, Origin, `ResolveService`.

У проді UI і API — різні хости (Vercel і Render). Cookie сесії має бути first-party, інакше браузер її не збереже. Тому JSON і live-потік ідуть на same-origin `/backend`; Next переписує цей шлях на API. Байти PDF — одразу на хост API: Vercel тіло 25 МіБ не проксує.

## Сесія

Вхід і реєстрація створюють серверну сесію, не JWT.

У cookie `session` кладеться непрозорий токен: 32 випадкові байти (`randomBytes`), у hex. У `auth_sessions` зберігається лише SHA-256. Витік дампу БД не дає готовий cookie: потрібно перебрати прообраз хешу.

Чому не JWT у localStorage: токен у JS доступний XSS; logout не відкликає вже випущений JWT, поки не закінчиться. Тут logout ставить `revoked_at`, cookie `httpOnly` — скрипт сторінки її не читає. Строк сесії — 12 годин (`SESSION_TTL_MS`).

Прапорці cookie (`getSessionCookieOptions`):

| Оточення | SameSite | Secure | Partitioned |
| --- | --- | --- | --- |
| development | `Lax` | немає | немає |
| production | `None` | так | так (CHIPS) |

Локально UI `:3000` і API `:4000` — один сайт з погляду браузера, вистачає Lax.

У проді це різні сайти (`deal-box.vercel.app` і `*.onrender.com`). `Set-Cookie` з хоста API для вкладки з UI — third-party; браузер її не кладе. Тому клієнт ходить на same-origin `/backend` (`NEXT_PUBLIC_API_URL`). Next ріже `/backend/:path*` на `API_PROXY_ORIGIN`. `Set-Cookie` логіну приходить уже з хоста UI і стає first-party.

Завантаження PDF — окремий хоп: Vercel 25 МіБ не проксує. `POST /files/upload-ticket` іде за сесією (same-origin). `POST /files` потім на `NEXT_PUBLIC_UPLOAD_API_URL` з `X-Upload-Ticket`. Квиток — HMAC від хешу сесії, 10 хвилин, це не загальна сесія: `UploadAuthGuard` приймає його лише на upload.

`Partitioned` у `Set-Cookie` пише `serializeSessionCookie`. Express `res.cookie` цей прапорець не віддає; без нього CHIPS не спрацював би, якщо відповідь колись піде крос-сайт.

`SessionGuard` висить глобально. Немає cookie / сесія відкликана або закінчилася → `401 unauthorized`. `SUSPENDED` → `403`, не `401`: обліковий запис є, пускати не можна.

`@Public()` сесію не вимагає (логін, публічне посилання, читання за `?token=`, локальна видача файла). Якщо cookie все ж валідна, користувач підставляється: залогінена людина за публічним посиланням лишається собою, посилання не підвищує роль.

## CSRF і CORS

Мутації з чужого сайту не повинні проходити з cookie жертви.

Окремого CSRF-токена у формі немає. JSON у проді — same-origin (`/backend`). Upload і будь-який прямий виклик Render — крос-сайт. Захист — `CsrfOriginGuard` на всі не-GET/HEAD/OPTIONS: заголовок `Origin` має бути в тому самому allowlist, що й CORS (`CORS_ORIGIN`). Не збігся → `403 forbidden`.

Чому Origin, а не Synchronizer Token: cookie на хості API в проді `SameSite=None`, credentialed-запит з origin UI її докладе. Перевірка Origin — той самий факт, який кодував би CSRF-токен. Браузерний fetch/XHR з іншого сайту сам ставить Origin; його не можна підробити з JS.

CORS: `credentials: true`. Браузер не прийме `Access-Control-Allow-Origin: *` разом із cookie, тому в development Origin віддзеркалюється, у test/production — явний список, інакше процес не стартує (`CorsOriginConfigError`).

Якщо Origin на мутації немає, гард пропускає запит. Так живуть curl, e2e і сервер-сервер. Браузерний CSRF з іншого сайту Origin зазвичай шле. Це свідомий компроміс, не дірка «будь-який сайт може POST».

## Паролі й перебір

Пароль — bcryptjs, 10 раундів. У `users.password_hash`. Email під час запису в lowercase, не citext.

Логін: немає користувача, немає хешу або невірний пароль → один і той самий `401 unauthorized`. Не можна відрізнити «email вільний» від «пароль не той» за кодом помилки.

Реєстрація на зайнятий email не віддає `email_taken`: bcrypt усе одно рахується, cookie не ставиться. Клієнт не логіниться.

Login і register ріжуться `@nestjs/throttler`: 10 запитів на хвилину (`AUTH_ABUSE_LIMIT` / `AUTH_ABUSE_WINDOW_MS`). У production `trust proxy = 1`, щоб ліміт ішов по IP за Render, а не по одній адресі проксі. У unit-тестах throttler вимкнений, для перевірки — `E2E_THROTTLE=1`.

OAuth, підтвердження пошти й скидання пароля в схемі є (`oauth_accounts`, `auth_tokens`), у продукті немає.

## Хто що може відкрити

Один вхід: `ResolveService`. Клієнт не надсилає `ownerId` і `storage_key`.

Порядок:

1. Сесія і `data_rooms.owner_id` збіглися → `owner`.
2. Інакше покривні гранти (кімната / предки за `folders.path` / сам файл) → максимум ролі.
3. Інакше публічний токен (хеш) → завжди `viewer`. Посилання не підвищує роль уже залогіненого.

Писати (`canWrite`) можуть owner і editor. Шарити й відкликати (`canShare`) — лише owner. Editor чужий доступ не роздає.

Немає права читати → `404 not_found`, без різниці «немає такого id» і «чуже». Хто ресурс бачить, але операція йому не по ролі → `403 forbidden`. Вгадувати чужі UUID за різницею статусів не можна.

Строк: `expires_at` у гранту й публічного посилання перевіряється під час читання (`expires_at IS NULL OR expires_at > now`). Максимум, який прийме API, — 365 днів. Інвайт живе 7 днів (`INVITE_TTL_MS`); `access_expires_at` копіюється в грант при accept.

Докладніше про успадкування й три таблиці доступу — в [архітектурі](./architecture.md) і [моделі даних](./database.md). Тут важливо: ACL рахується на кожен запит, не кешується в cookie.

## Публічні посилання й інвайти

Сирий токен — ті самі 32 байти, у базі SHA-256. Витік рядка не відкриває посилання. Сирий токен один раз у відповіді create і далі лише в URL.

Публічне посилання завжди viewer: колонки ролі немає. Неавторизований відвідувач не пише.

Пошук за `?token=` і `POST/GET …/public-links/resolve` ріже `PublicAbuseGuard` (той самий ліміт 10/хв). Звичайний диск із сесією без `token` не чіпає: інакше listing уперся б у ту саму стелю. `GET /search?token=` сюди входить: неавторизований пошук за посиланням — той самий клас публічного трафіку.

Сам пошук чужі імена не світить: немає доступу до кімнати → `404 not_found`, як у listing. `%` і `_` у `q` екрануються і не стають масками LIKE. Пошук за публічним посиланням обмежений ціллю посилання, не всією кімнатою власника.

## Файли

Upload лише PDF: magic bytes `%PDF`, MIME в базі примусово `application/pdf`. Ліміт 25 МіБ (`MAX_FILE_BYTES`) — і в Multer, і ще раз у сервісі. Ім’я й ключ об’єкта клієнт не задає.

Ключ збирає сервер: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. `assertSafeStorageKey` відсікає `..` і `//`, щоб локальний драйвер не вийшов із каталогу `.storage`.

Бакет закритий. Завантажити можна лише за тимчасовим посиланням після ACL (~15 хвилин, `DEFAULT_DOWNLOAD_TTL_SECONDS`). Якщо доступ закінчується раніше, TTL посилання урізається (підлога не нижче 30 секунд).

- R2: presigned GET (не PUT).
- Local: HMAC-SHA256 власного секрету, публічний `GET /storage/objects`. Підпис і є пропуск, як у Cloudflare. Порівняння підпису — `timingSafeEqual`. У development секрет може бути дефолтним `local-dev-signing-secret`; у production при `local` його потрібно задати.

Після відкликання нові URL не видаються. Уже підписане посилання живе до TTL: відкликати об’єкт у R2 за секунду не можна без окремих signed-cookie / короткого TTL. 15 хвилин — компроміс між UX перегляду PDF і вікном після revoke.

`Content-Disposition` задає сервер (`inline` / `attachment`), з імені вирізаються CR/LF.

## Живі події

`GET /events` — `@Public()`, але до заголовків SSE працює `EventsHandshakeGuard`. Інакше Nest уже віддав би `200 text/event-stream`, і 401/404 запізнилися б.

Підписка: валідна сесія або активне публічне посилання. Чужий `dataRoomId` у query тихо ігнорується, `404` по ньому не світиться.

Реєстр з’єднань у пам’яті процесу (ліміт 5 на користувача, 3 на публічне посилання). Кілька replica Nest без pub/sub можуть не доставити дзвіночок про відкликання. Джерело прав усе одно REST + `ResolveService`: після reconnect клієнт перезапитує. Push — прискорення UX, не ACL.

## Журнал

Читати `GET /data-rooms/:id/activity` може лише власник кімнати, інакше `404`. Запис перегляду/завантаження йде через той самий resolve (сесія або токен). У логах API сирі `token` / `sig` затираються (`redactRequestUrl`).

## Клієнт

Axios і live-потік шлють cookie (`withCredentials` / `credentials: 'include'`). Токен сесії в `localStorage` не кладеться.

Login і register не ведуть на Диск за одним JSON 200. Клієнт потім кличе `GET /auth/me` (`confirmSession`): немає cookie — форма лишається, профіль не вважається сесією. GuestOnly редиректить лише за `me.isSuccess`. `401` на Диску чистить auth-кеш (`useRedirectUnauthorized`) і йде на `/login`.

Редирект із `/drive` для гостя — клієнтський (`useMe`), не Next middleware. Це UX, не захист.

Сторінки `/drive` і `/share`: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` — щоб PDF-URL і id не витікали в Referer пошуковикам. Відповіді API теж `private, no-store` (`NoStoreCacheInterceptor`).

Тіла запитів валідує Zod (`ZodValidationPipe`). У PostgreSQL — Prisma, не склеювання SQL.

## Обмеження, які потрібно знати

- Підписаний download після revoke діє до TTL (зазвичай до 15 хвилин).
- Видалення файла/папки спочатку знімає рядки в PostgreSQL, об’єкт у сховищі — best-effort. Збій R2/диска залишає сироту; API все одно відповідає успіхом.
- SSE в одному процесі: горизонтальне масштабування без Redis не доставляє live-revoke на інший інстанс.
- Мутація без заголовка Origin проходить CSRF-гард (небраузерні клієнти).
- Якщо шарять на вже існуючий email, `InviteService` створює грант і у відповіді віддає випадковий `token`, який у базу не пишеться. Робочий інвайт-токен є лише в pending-запрошення.
