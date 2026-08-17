# Як запустити проєкт

Потрібні [Node.js](https://nodejs.org/) 20+ і [Docker Desktop](https://docs.docker.com/get-docker/) (має бути запущений). PostgreSQL на комп’ютер ставити не потрібно: скрипт підніме його сам.

```bash
git clone https://github.com/Miros908/secure-data-room.git
cd secure-data-room
bash scripts/start.sh
```

Команда поставить залежності, скопіює налаштування, підніме базу, застосує міграції й запустить проєкт.

- Інтерфейс: [http://localhost:3000](http://localhost:3000)
- Реєстрація: [http://localhost:3000/register](http://localhost:3000/register)
- API: [http://localhost:4000](http://localhost:4000)

Локально готових користувачів немає — створіть обліковий запис на `/register`. Для задеплоєного застосунку акаунти для перевіряючого — в [README](./README.md#тестові-акаунти-для-перевіряючого).

Повторний запуск — знову `bash scripts/start.sh` (або `pnpm start:local`). Якщо база вже запущена на порті 5432, Docker повторно не стартує.

## Якщо не стартує

| Симптом | Що зробити |
| --- | --- |
| `pnpm: command not found` | Установіть Node.js 20+, потім знову `bash scripts/start.sh` |
| Docker не знайдено / не запущено | Установіть і відкрийте Docker Desktop, повторіть команду |
| Помилка підключення до Postgres | Якщо Postgres уже стоїть локально з іншим паролем, виправте `DATABASE_URL` у `apps/nestjs-backend/.env` |
| Порт 3000 або 4000 зайнятий | Зупиніть інший процес на цьому порті й повторіть команду |
