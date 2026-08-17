# How to run the project

You need [Node.js](https://nodejs.org/) 20+ and [Docker Desktop](https://docs.docker.com/get-docker/) (it must be running). You do not need to install PostgreSQL on the machine: the script starts it for you.

```bash
git clone https://github.com/Miros908/secure-data-room.git
cd secure-data-room
bash scripts/start.sh
```

The command installs dependencies, copies settings, starts the database, applies migrations, and runs the project.

- UI: [http://localhost:3000](http://localhost:3000)
- Registration: [http://localhost:3000/register](http://localhost:3000/register)
- API: [http://localhost:4000](http://localhost:4000)

Locally there are no seeded users — create an account at `/register`. For the hosted app, reviewer accounts are in the [README](./README.md#test-accounts-reviewer).

To start again — run `bash scripts/start.sh` again (or `pnpm start:local`). If the database is already running on port 5432, Docker will not start a second time.

## If it does not start

| Symptom | What to do |
| --- | --- |
| `pnpm: command not found` | Install Node.js 20+, then run `bash scripts/start.sh` again |
| Docker not found / not running | Install and open Docker Desktop, then retry the command |
| Postgres connection error | If Postgres is already installed locally with a different password, fix `DATABASE_URL` in `apps/nestjs-backend/.env` |
| Port 3000 or 4000 is in use | Stop the other process on that port and retry the command |

