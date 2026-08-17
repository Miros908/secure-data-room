# How it scales

The current model is designed to grow without changing the core entities: files and folders belong to a Data Room, access is granted at the room, folder, or file level, and file versions are stored separately from the main file row.

## A Data Room with 100,000 files

The API does not load the whole Data Room tree. Opening a folder requests only its immediate child folders and files:

* `GET /folders?dataRoomId=...`
* `GET /folders/:id`

The listing returns file metadata, not PDF contents. The file itself is loaded separately via a signed URL only when opened.

So the number of files in the whole Data Room by itself does not increase the response size when opening a specific folder. Listing cost depends primarily on the number of items inside the open folder.

These queries use indexes:

```text
folders: (data_room_id, parent_id, name, id)
files:   (data_room_id, folder_id, name, id)
```

The current limit is that listing has no pagination yet. If one folder starts containing thousands of files or subfolders, the next step is to move pagination to the backend and use keyset pagination on `(name, id)`:

```sql
WHERE (name, id) > (...)
ORDER BY name, id
LIMIT n
```

Offset pagination must not be used for large catalogs, because its cost grows with page depth.

Sorting by other fields, such as date or size, must also run on the server together with matching indexes.

Search is `GET /search`, not folder listing. ACL is in the same SQL as the name match ([architecture](./architecture.md)). Wildcards in `q` are escaped. Results are keyset-paginated on `(name, kind, id)` with `LIMIT` (default 20, max 50). Substring `ILIKE` uses GIN trigram indexes:

```text
files_name_trgm_idx
folders_name_trgm_idx
```

plus the existing btree on `data_room_id`. There is no `COUNT(*)` and no `OFFSET`.

## Size and item count in a folder

Subtree operations use `countSubtree`.

Before deleting a folder the following are determined:

* the number of nested folders;
* the number of files inside the whole subtree.

Descendant folders are found via `path`, then files belonging to those folders are counted.

This mechanism is currently used to warn the user before delete and is not run on every folder open.

The size of the whole subtree in bytes is not computed separately today. If it is needed, `SUM(size_bytes)` over the found files can be added to the same subtree query.

There are no standing counters on `folders` today, so there is no extra logic to keep them in sync on upload, delete, or move.

## Sharing and roles

Access is stored separately from the file tree: a grant on a room, folder, or file. `VIEWER` / `EDITOR` are already in the model, so editor sharing does not need a new table. Inheritance and `already_covered` — [architecture](./architecture.md).

A folder grant does not create a row per nested file, so a shared folder of 100,000 files is still one grant row.

The owner is `data_rooms.owner_id`, not an `access_grant`. Revoking a grant cannot delete ownership.

## Several Data Rooms for one user

Today `owner_id` is unique, so one user owns one Data Room, created at registration.

All other entities are already bound to `data_room_id`:

* folders;
* files;
* access grants;
* public links;
* audit log;
* file versions.

So supporting several Data Rooms for one owner requires dropping the unique constraint on `owner_id` and adding a room picker in the UI.

The file structure and the sharing mechanism do not need to change.

## File versions

Re-uploading a file with the same name does not create an extra row in the folder listing.

The main row stays in `files`, and versions live separately in `file_versions`.

The current version is determined via:

```text
current_version_id
```

So growing the number of versions does not grow the number of files returned when listing a folder.

A specific version can be opened via:

```text
GET /files/:id/versions/:versionId
```

With a large number of versions the main growing resources become the versions table and blob storage. A policy for deleting old versions is not implemented today.

## Audit log

The audit log is append-only.

History is not loaded in full: events are served in pages via cursor pagination:

```text
(created_at, id)
```

Page size is 20 events.

The index used:

```text
(data_room_id, created_at, id)
```

So growing the room's overall history does not require loading all previous events.

TTL or archiving of old events is not implemented today.

## Several API instances

Sessions live in PostgreSQL, so authorization does not depend on the memory of a particular NestJS process.

Several API instances can handle requests without sticky sessions.

Live events, however, currently live in process memory. If several API instances are started, an event created on one instance will not automatically be delivered to a client connected to another.

This limit applies to live notifications, not to the access check itself: `ResolveService` remains the source of the authorization decision on a REST request.

Syncing live events across several API instances would need an external pub/sub, for example Redis. That mechanism is not implemented today.
