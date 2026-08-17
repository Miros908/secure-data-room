# База даних

PostgreSQL зберігає користувачів, сесії, дерево папок, метадані файлів, доступи й журнал. Байтів PDF тут немає: об’єкт лежить у сховищі (диск або R2), у базі лише `storage_key`.

У проді PostgreSQL теж задеплоєний на Render, поруч із NestJS API.

Схема Prisma: `apps/nestjs-backend/prisma/schema.prisma`.

## Схема

### Кімната, папки, файли

```mermaid
erDiagram
    users {
        uuid id PK
        string email
        UserStatus status
    }

    auth_sessions {
        uuid id PK
        uuid user_id FK
        string refresh_token_hash
        datetime expires_at
        datetime revoked_at
    }

    data_rooms {
        uuid id PK
        uuid owner_id FK
        string name
    }

    folders {
        uuid id PK
        uuid data_room_id FK
        uuid parent_id FK
        string name
        string path
    }

    files {
        uuid id PK
        uuid data_room_id FK
        uuid folder_id FK
        uuid uploaded_by_id FK
        uuid current_version_id FK
        string name
        string mime_type
        bigint size_bytes
    }

    file_versions {
        uuid id PK
        uuid file_id FK
        int version_number
        string storage_key
        string mime_type
        bigint size_bytes
        uuid uploaded_by_id FK
    }
```

### Доступ і журнал

```mermaid
erDiagram
    users {
        uuid id PK
        string email
    }

    data_rooms {
        uuid id PK
        uuid owner_id FK
    }

    access_grants {
        uuid id PK
        uuid user_id FK
        uuid granted_by_id FK
        uuid data_room_id FK
        uuid folder_id FK
        uuid file_id FK
        AccessRole role
        datetime expires_at
        datetime revoked_at
    }

    access_invitations {
        uuid id PK
        uuid granted_by_id FK
        string email
        string token_hash
        uuid data_room_id FK
        uuid folder_id FK
        uuid file_id FK
        AccessRole role
        datetime expires_at
        datetime access_expires_at
        datetime accepted_at
        datetime revoked_at
    }

    public_share_links {
        uuid id PK
        uuid created_by_id FK
        uuid data_room_id FK
        uuid folder_id FK
        uuid file_id FK
        string token_hash
        datetime expires_at
        datetime revoked_at
    }

    activity_events {
        uuid id PK
        uuid data_room_id FK
        ActivityEventType type
        uuid actor_user_id FK
        uuid public_share_link_id FK
        uuid file_id
        uuid folder_id
        string resource_name
    }
```

## Таблиці

**`users`** — обліковий запис. Вхід за email і паролем. Email завжди lowercase, пароль — bcrypt у `password_hash`. `SUSPENDED` не пускає в API.

**`auth_sessions`** — серверна сесія. У cookie сирий токен, у таблиці SHA-256. Logout ставить `revoked_at`.

**`data_rooms`** — кімната даних, корінь «мого диска». У користувача рівно одна. Створюється під час реєстрації. Власник має повний доступ без рядка в `access_grants`.

**`folders`** — папка в кімнаті. `parent_id` порожній — у корені. `path` — ланцюжок UUID предків (`/id/id/`), без імен: rename не переписує дерево. Папки переміщувати не можна. Пошук за ім’ям — GIN trigram-індекс, як у файлів.

**`files`** — документ у папці або в корені кімнати. Listing дивиться сюди. `size_bytes` і `mime_type` — знімок поточної версії. Повторний upload того самого імені додає версію, не другий рядок. Пошук за підрядком — GIN trigram-індекс на `name` (`pg_trgm`), окремо від btree listing `(data_room_id, folder_id, name, id)`.

**`file_versions`** — одне завантаження вмісту. Тут `storage_key` об’єкта в сховищі, номер версії, розмір, MIME.

**`access_grants`** — доступ уже зареєстрованому користувачу (`VIEWER` / `EDITOR`). Відкликання = `revoked_at`, рядок не видаляють. `expires_at` порожній — безстроково.

**`access_invitations`** — запрошення на email, поки облікового запису немає. Само по собі кімнату не відкриває. Після реєстрації або логіну створюється грант, сюди пишеться `accepted_at`. `expires_at` — до якого моменту можна прийняти; `access_expires_at` копіюється в грант.

**`public_share_links`** — публічне посилання без облікового запису. Завжди лише перегляд, колонки ролі немає. В URL сирий токен, у базі хеш.

**`activity_events`** — журнал кімнати. API рядки не оновлює і не видаляє. `file_id` / `folder_id` без зовнішнього ключа: після видалення файла історія лишається, ім’я лежить у `resource_name`. Читати може лише власник.

`oauth_accounts` і `auth_tokens` у Prisma є, продукт їх не використовує.

## Ціль доступу

У гранту, інвайту й публічного посилання одна й та сама модель цілі. Папку й файл одразу вказати не можна.

| `folder_id` | `file_id` | Що покрито |
| --- | --- | --- |
| порожньо | порожньо | вся кімната |
| задано | порожньо | папка і нащадки |
| порожньо | задано | один файл |

## Enums

**`UserStatus`** — стан облікового запису (`users.status`).

- `ACTIVE` — можна увійти
- `SUSPENDED` — сесія більше не пускає в API

**`AccessRole`** — роль гранту й інвайту (`access_grants.role`, `access_invitations.role`). У публічного посилання ролі немає.

- `VIEWER` — лише перегляд і завантаження
- `EDITOR` — може писати (завантажувати, перейменовувати, переміщувати, видаляти)

**`ActivityEventType`** — тип запису в журналі (`activity_events.type`).

- `FILE_VIEWED` — відкрили файл
- `FILE_DOWNLOADED` — завантажили файл
- `LINK_OPENED` — зайшли за публічним посиланням
- `ACCESS_GRANTED` — видали доступ
- `ACCESS_REVOKED` — відкликали доступ
- `FILE_DELETED` — видалили файл
- `FOLDER_DELETED` — видалили папку
