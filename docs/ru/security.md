# Безопасность

Граница доверия — **NestJS API**. Next.js не проверяет сессию в middleware и не читает cookie: если обойти UI, правила те же — cookie или upload-ticket, Origin, `ResolveService`.

В проде UI и API — разные хосты (Vercel и Render). Cookie сессии должна быть first-party, иначе браузер её не сохранит. Поэтому JSON и live-поток идут на same-origin `/backend`; Next переписывает этот путь на API. Байты PDF — сразу на хост API: Vercel тело 25 МиБ не проксирует.

## Сессия

Вход и регистрация создают серверную сессию, не JWT.

В cookie `session` кладётся непрозрачный токен: 32 случайных байта (`randomBytes`), в hex. В `auth_sessions` хранится только SHA-256. Утечка дампа БД не даёт готовый cookie: нужно перебрать прообраз хеша.

Почему не JWT в localStorage: токен в JS доступен XSS; logout не отзывает уже выпущенный JWT, пока не истечёт. Здесь logout ставит `revoked_at`, cookie `httpOnly` — скрипт страницы её не читает. Срок сессии — 12 часов (`SESSION_TTL_MS`).

Флаги cookie (`getSessionCookieOptions`):

| Окружение | SameSite | Secure | Partitioned |
| --- | --- | --- | --- |
| development | `Lax` | нет | нет |
| production | `None` | да | да (CHIPS) |

Локально UI `:3000` и API `:4000` — один сайт с точки зрения браузера, хватает Lax.

В проде это разные сайты (`deal-box.vercel.app` и `*.onrender.com`). `Set-Cookie` с хоста API для вкладки с UI — third-party; браузер её не кладёт. Поэтому клиент ходит на same-origin `/backend` (`NEXT_PUBLIC_API_URL`). Next режет `/backend/:path*` на `API_PROXY_ORIGIN`. `Set-Cookie` логина приходит уже с хоста UI и становится first-party.

Загрузка PDF — отдельный хоп: Vercel 25 МиБ не проксирует. `POST /files/upload-ticket` идёт по сессии (same-origin). `POST /files` затем на `NEXT_PUBLIC_UPLOAD_API_URL` с `X-Upload-Ticket`. Тикет — HMAC от хеша сессии, 10 минут, это не общая сессия: `UploadAuthGuard` принимает его только на upload.

`Partitioned` в `Set-Cookie` пишет `serializeSessionCookie`. Express `res.cookie` этот флаг не отдаёт; без него CHIPS не сработал бы, если ответ когда-нибудь уйдёт кросс-сайт.

`SessionGuard` висит глобально. Нет cookie / сессия отозвана или истекла → `401 unauthorized`. `SUSPENDED` → `403`, не `401`: аккаунт есть, пускать нельзя.

`@Public()` сессию не требует (логин, публичная ссылка, чтение по `?token=`, локальная выдача файла). Если cookie всё же валидна, пользователь подставляется: залогиненный человек по публичной ссылке остаётся собой, ссылка не повышает роль.

## CSRF и CORS

Мутации с чужого сайта не должны проходить с cookie жертвы.

Отдельного CSRF-токена в форме нет. JSON в проде — same-origin (`/backend`). Upload и любой прямой вызов Render — кросс-сайт. Защита — `CsrfOriginGuard` на все не-GET/HEAD/OPTIONS: заголовок `Origin` должен быть в том же allowlist, что и CORS (`CORS_ORIGIN`). Не совпал → `403 forbidden`.

Почему Origin, а не Synchronizer Token: cookie на хосте API в проде `SameSite=None`, credentialed-запрос с origin UI её приложит. Проверка Origin — тот же факт, который кодировал бы CSRF-токен. Браузерный fetch/XHR с другого сайта сам ставит Origin; его нельзя подделать из JS.

CORS: `credentials: true`. Браузер не примет `Access-Control-Allow-Origin: *` вместе с cookie, поэтому в development Origin отражается, в test/production — явный список, иначе процесс не стартует (`CorsOriginConfigError`).

Если Origin на мутации нет, гард пропускает запрос. Так живут curl, e2e и сервер-сервер. Браузерный CSRF с другого сайта Origin обычно шлёт. Это сознательный компромисс, не дыра «любой сайт может POST».

## Пароли и перебор

Пароль — bcryptjs, 10 раундов. В `users.password_hash`. Email при записи в lowercase, не citext.

Логин: нет пользователя, нет хеша или неверный пароль → один и тот же `401 unauthorized`. Нельзя отличить «email свободен» от «пароль не тот» по коду ошибки.

Регистрация на занятый email не отдаёт `email_taken`: bcrypt всё равно считается, cookie не ставится. Клиент не логинится.

Login и register режутся `@nestjs/throttler`: 10 запросов в минуту (`AUTH_ABUSE_LIMIT` / `AUTH_ABUSE_WINDOW_MS`). В production `trust proxy = 1`, чтобы лимит шёл по IP за Render, а не по одному адресу прокси. В unit-тестах throttler выключен, для проверки — `E2E_THROTTLE=1`.

OAuth, подтверждение почты и сброс пароля в схеме есть (`oauth_accounts`, `auth_tokens`), в продукте нет.

## Кто что может открыть

Один вход: `ResolveService`. Клиент не присылает `ownerId` и `storage_key`.

Порядок:

1. Сессия и `data_rooms.owner_id` совпали → `owner`.
2. Иначе покрывающие гранты (комната / предки по `folders.path` / сам файл) → максимум роли.
3. Иначе публичный токен (хеш) → всегда `viewer`. Ссылка не повышает роль уже залогиненного.

Писать (`canWrite`) могут owner и editor. Шарить и отзывать (`canShare`) — только owner. Editor чужой доступ не раздаёт.

Нет права читать → `404 not_found`, без различия «нет такого id» и «чужое». Кто ресурс видит, но операция ему не по роли → `403 forbidden`. Угадывать чужие UUID по разнице статусов нельзя.

Срок: `expires_at` у гранта и публичной ссылки проверяется при чтении (`expires_at IS NULL OR expires_at > now`). Максимум, который примет API, — 365 дней. Инвайт живуч 7 дней (`INVITE_TTL_MS`); `access_expires_at` копируется в грант при accept.

Подробнее про наследование и три таблицы доступа — в [архитектуре](./architecture.md) и [модели данных](./database.md). Здесь важно: ACL считается на каждый запрос, не кэшируется в cookie.

## Публичные ссылки и инвайты

Сырой токен — те же 32 байта, в базе SHA-256. Утечка строки не открывает ссылку. Сырой токен один раз в ответе create и дальше только в URL.

Публичная ссылка всегда viewer: колонки роли нет. Неавторизованный посетитель не пишет.

Поиск по `?token=` и `POST/GET …/public-links/resolve` режет `PublicAbuseGuard` (тот же лимит 10/мин). Обычный диск с сессией без `token` не трогает: иначе listing упёрся бы в тот же потолок. `GET /search?token=` сюда входит: неавторизованный поиск по ссылке — тот же класс публичного трафика.

Сам поиск чужие имена не светит: нет доступа к комнате → `404 not_found`, как у listing. `%` и `_` в `q` экранируются и не становятся масками LIKE. Поиск по публичной ссылке ограничен целью ссылки, не всей комнатой владельца.

## Файлы

Upload только PDF: magic bytes `%PDF`, MIME в базе принудительно `application/pdf`. Лимит 25 МиБ (`MAX_FILE_BYTES`) — и в Multer, и ещё раз в сервисе. Имя и ключ объекта клиент не задаёт.

Ключ собирает сервер: `{prefix}/{dataRoomId}/{fileId}/{versionId}`. `assertSafeStorageKey` отсекает `..` и `//`, чтобы локальный драйвер не вышел из каталога `.storage`.

Бакет закрытый. Скачать можно только по временной ссылке после ACL (~15 минут, `DEFAULT_DOWNLOAD_TTL_SECONDS`). Если доступ истекает раньше, TTL ссылки урезается (пол не ниже 30 секунд).

- R2: presigned GET (не PUT).
- Local: HMAC-SHA256 своего секрета, публичный `GET /storage/objects`. Подпись и есть пропуск, как у Cloudflare. Сравнение подписи — `timingSafeEqual`. В development секрет может быть дефолтным `local-dev-signing-secret`; в production при `local` его нужно задать.

После отзыва новые URL не выдаются. Уже подписанная ссылка живёт до TTL: отозвать объект в R2 за секунду нельзя без отдельных signed-cookie / короткого TTL. 15 минут — компромисс между UX просмотра PDF и окном после revoke.

`Content-Disposition` задаёт сервер (`inline` / `attachment`), из имени вырезаются CR/LF.

## Живые события

`GET /events` — `@Public()`, но до заголовков SSE работает `EventsHandshakeGuard`. Иначе Nest уже отдал бы `200 text/event-stream`, и 401/404 опоздали бы.

Подписка: валидная сессия или активная публичная ссылка. Чужой `dataRoomId` в query тихо игнорируется, `404` по нему не светится.

Реестр соединений в памяти процесса (лимит 5 на пользователя, 3 на публичную ссылку). Несколько replica Nest без pub/sub могут не доставить колокольчик об отзыве. Источник прав всё равно REST + `ResolveService`: после reconnect клиент переспрашивает. Push — ускорение UX, не ACL.

## Журнал

Читать `GET /data-rooms/:id/activity` может только владелец комнаты, иначе `404`. Запись просмотра/скачивания идёт через тот же resolve (сессия или токен). В логах API сырые `token` / `sig` затираются (`redactRequestUrl`).

## Клиент

Axios и live-поток шлют cookie (`withCredentials` / `credentials: 'include'`). Токен сессии в `localStorage` не кладётся.

Login и register не ведут на Диск по одному JSON 200. Клиент затем зовёт `GET /auth/me` (`confirmSession`): нет cookie — форма остаётся, профиль не считается сессией. GuestOnly редиректит только при `me.isSuccess`. `401` на Диске чистит auth-кеш (`useRedirectUnauthorized`) и уходит на `/login`.

Редирект с `/drive` для гостя — клиентский (`useMe`), не Next middleware. Это UX, не защита.

Страницы `/drive` и `/share`: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` — чтобы PDF-URL и id не утекали в Referer поисковикам. Ответы API тоже `private, no-store` (`NoStoreCacheInterceptor`).

Тела запросов валидирует Zod (`ZodValidationPipe`). В PostgreSQL — Prisma, не склейка SQL.

## Ограничения, которые нужно знать

- Подписанный download после revoke действует до TTL (обычно до 15 минут).
- Удаление файла/папки сначала снимает строки в PostgreSQL, объект в хранилище — best-effort. Сбой R2/диска оставляет сироту; API всё равно отвечает успехом.
- SSE в одном процессе: горизонтальное масштабирование без Redis не доставляет live-revoke на другой инстанс.
- Мутация без заголовка Origin проходит CSRF-гард (не-браузерные клиенты).
- Если шарят на уже существующий email, `InviteService` создаёт грант и в ответе отдаёт случайный `token`, который в базу не пишется. Рабочий инвайт-токен есть только у pending-приглашения.
