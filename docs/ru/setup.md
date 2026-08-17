# Как запустить проект

Нужны [Node.js](https://nodejs.org/) 20+ и [Docker Desktop](https://docs.docker.com/get-docker/) (должен быть запущен). PostgreSQL на компьютер ставить не нужно: скрипт поднимет его сам.

```bash
git clone https://github.com/Miros908/secure-data-room.git
cd secure-data-room
bash scripts/start.sh
```

Команда поставит зависимости, скопирует настройки, поднимет базу, применит миграции и запустит проект.

- Интерфейс: [http://localhost:3000](http://localhost:3000)
- Регистрация: [http://localhost:3000/register](http://localhost:3000/register)
- API: [http://localhost:4000](http://localhost:4000)

Локально готовых пользователей нет — создайте аккаунт на `/register`. Для задеплоенного приложения аккаунты для проверяющего — в [README](./README.md#тестовые-аккаунты-для-проверяющего).

Повторный запуск — снова `bash scripts/start.sh` (или `pnpm start:local`). Если база уже запущена на порту 5432, Docker повторно не стартует.

## Если не стартует

| Симптом | Что сделать |
| --- | --- |
| `pnpm: command not found` | Установите Node.js 20+, затем снова `bash scripts/start.sh` |
| Docker не найден / не запущен | Установите и откройте Docker Desktop, повторите команду |
| Ошибка подключения к Postgres | Если Postgres уже стоит локально с другим паролем, поправьте `DATABASE_URL` в `apps/nestjs-backend/.env` |
| Порт 3000 или 4000 занят | Остановите другой процесс на этом порту и повторите команду |

