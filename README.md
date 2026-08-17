# Data Room

An app for exchanging and sharing files: nested folders, public links or per-user access, revoke, and an activity log for the owner.

**Docs:** [English](docs/en/README.md) · [Русский](docs/ru/README.md) · [Українська](docs/ua/README.md)

## Hosted

- Frontend: https://deal-box.vercel.app
- API: https://secure-data-room.onrender.com

## Test accounts (reviewer)

For the hosted app at [deal-box.vercel.app](https://deal-box.vercel.app):

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner-test@gmail.com` | `12345678` |
| Viewer | `viewer-test@gmail.com` | `12345678` |

## Setup

Node.js 20+ and Docker Desktop. From the repo root:

```bash
bash scripts/start.sh
```

UI: [http://localhost:3000](http://localhost:3000) · API: [http://localhost:4000](http://localhost:4000) · details: [setup](docs/en/setup.md)

## Design

- [Architecture](docs/en/architecture.md) — decisions, ACL, upload/delete
- [Database / ERD](docs/en/database.md)
- [How it scales](docs/en/how-it-scales.md) — subtree size, 100k files, viewer/editor
- [AI usage](docs/en/README.md#ai-usage)
- [Stack](docs/en/stack.md) · [Security](docs/en/security.md) · [Tests](docs/en/testing.md)
