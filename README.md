# Конвертер валют в Docker

Из папки проекта запустите Docker Desktop в режиме Linux-контейнеров. Затем выполните:

```powershell
docker compose up --build -d
docker compose ps -a
```

- [Конвертер и чат](http://localhost:8080)
- [Express API](http://localhost:5000/currencies)
- [API через Nginx](http://localhost:8080/api/currencies)

PostgreSQL принимает подключения внутри сети Compose под именем `db`. Проверка `pg_isready` ждёт готовности базы. Затем `db-init` применяет миграции и загружает демоданные. После успешной инициализации (статус `Exited (0)`) стартует Express. Выполненные сидеры запоминаются в таблице `SequelizeData`, поэтому обычный повторный запуск не сбрасывает данные. Именованный том `pgdata` сохраняет данные при удалении и пересоздании контейнера.

Nginx раздаёт сборку React, пересылает `/api/` в Express и проксирует `/socket.io/` с поддержкой WebSocket. Для проверки чата откройте приложение в двух окнах, войдите под разными именами в USD и отправьте сообщение. Затем в одном окне перейдите в EUR и проверьте изоляцию комнат.

Контейнеры используют отдельную PostgreSQL со стартовым набором данных. Существующая база Windows сама в контейнер не переносится. Маршруты MongoDB предыдущей лабы требуют отдельного подключения MongoDB. Для обычного запуска Node.js и Vite см. [инструкцию проекта](лаб1/README.md).

Демонастройки рассчитаны на локальную работу. Перед первым запуском можно задать в PowerShell `$env:POSTGRES_PASSWORD` (буквы, цифры, дефис, подчёркивание) и `$env:JWT_SECRET`. Если порты заняты, задайте `$env:FRONTEND_PORT` или `$env:BACKEND_PORT` перед запуском Compose. Параметры `NODE_IMAGE`, `NGINX_IMAGE` и `POSTGRES_IMAGE` позволяют указать другой реестр. По умолчанию используются официальные образы Docker Hub. Зеркало при необходимости настраивается в Docker Desktop → Settings → Docker Engine.

```powershell
docker compose logs --tail 50 backend frontend db-init
docker compose down
```

`docker compose down` оставляет именованный том. Ключ `-v` удаляет его вместе с данными.
