#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Проверка Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Установите Node.js 20 или новее: https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Нужен Node.js 20+. Сейчас установлена $(node -v)."
  exit 1
fi

echo "→ Включаю pnpm..."
corepack enable

echo "→ Ставлю зависимости..."
pnpm install

echo "→ Копирую настройки..."
if [ ! -f apps/nestjs-backend/.env ]; then
  cp apps/nestjs-backend/.env.example apps/nestjs-backend/.env
fi
if [ ! -f apps/nextjs-frontend/.env ]; then
  cp apps/nextjs-frontend/.env.example apps/nextjs-frontend/.env
fi

postgres_ready() {
  node -e "const n=require('net');const s=n.connect({host:'127.0.0.1',port:5432},()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"
}

wait_for_postgres() {
  echo "  Жду готовности Postgres..."
  for _ in $(seq 1 40); do
    if postgres_ready; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL не ответил на порту 5432 за 40 секунд."
  exit 1
}

echo "→ База данных..."
if postgres_ready; then
  echo "  PostgreSQL уже слушает порт 5432, Docker не запускаю."
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "PostgreSQL не запущен, и Docker не найден."
    echo "Установите Docker Desktop: https://docs.docker.com/get-docker/"
    echo "Запустите его и повторите команду — скрипт сам поднимет базу."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker установлен, но не запущен. Откройте Docker Desktop и повторите команду."
    exit 1
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx sdr-postgres; then
    echo "  Запускаю уже созданный контейнер sdr-postgres..."
    docker start sdr-postgres >/dev/null
  else
    echo "  Поднимаю PostgreSQL в Docker (первый раз скачает образ)..."
    if docker compose version >/dev/null 2>&1; then
      docker compose up -d --wait
    elif command -v docker-compose >/dev/null 2>&1; then
      docker-compose up -d
    else
      echo "Нужен Docker Compose. Обновите Docker Desktop: https://docs.docker.com/get-docker/"
      exit 1
    fi
  fi
  wait_for_postgres
fi

echo "→ Миграции..."
pnpm --filter api prisma:migrate:deploy
pnpm --filter api prisma:generate

echo "→ Собираю shared-пакет..."
pnpm --filter @sdr/shared build

echo
echo "Готово. Сейчас поднимутся интерфейс и API."
echo "  Интерфейс:  http://localhost:3000"
echo "  Регистрация: http://localhost:3000/register"
echo "  API:         http://localhost:4000"
echo

export NODE_ENV=development
pnpm dev
