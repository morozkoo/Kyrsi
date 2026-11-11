# Currency Converter API

Учебное REST API для приложения конвертации валют и расчёта курсов. Данные хранятся в PostgreSQL через Sequelize.

## Лабораторная работа №6: MongoDB

В ветке `26` добавлена параллельная документная реализация справочника валют через Mongoose. Прежние маршруты `/currencies`, пользователи и вход продолжают работать с PostgreSQL. Новые маршруты `/mongo/currencies` работают с MongoDB; для изменения данных подходит существующий JWT пользователя с ролью `admin`.

Скопируйте `.env.example` в `.env` и заполните `DATABASE_URL`, `JWT_SECRET` и `MONGO_URI`. Для локальной MongoDB можно использовать `mongodb://127.0.0.1:27017/currency_converter`. Для Atlas вставьте выданную им строку `mongodb+srv://...` с именем базы `currency_converter` и учётными данными созданного пользователя. Пароль, URI и JWT-секрет не публикуйте в Git; `.env` исключён из репозитория.

После запуска PostgreSQL и MongoDB выполните из каталога `лаб1`:

```bash
npm install
npm run db:migrate
npm run dev
```

При отсутствии `MONGO_URI` или недоступной MongoDB сервер продолжит обслуживать PostgreSQL-маршруты, а запросы к `/mongo/currencies` вернут `503`. Если база PostgreSQL уже подготовлена, повторные миграции не нужны.

Чтобы скопировать существующий справочник из PostgreSQL в MongoDB, выполните `npm run db:seed:mongo`. Команда создаёт только отсутствующие валюты, поэтому её можно запускать повторно. Для каждой валюты она добавляет начальную запись в `rateHistory`.

Документ валюты содержит `code`, `name`, `symbol`, текущий `rateToRub` и вложенный массив `rateHistory`. В каждой записи истории есть собственный ObjectId, курс, источник (`manual` или `cbr`), заметка и время. В PostgreSQL текущий курс лежит в строке таблицы `currencies`; для такой истории обычно потребовалась бы отдельная таблица со связью по коду валюты. В MongoDB история находится внутри документа валюты.

| Метод | Маршрут | Действие |
| --- | --- | --- |
| GET | `/mongo/currencies` | Список документов |
| GET | `/mongo/currencies/:id` | Документ по MongoDB ObjectId |
| POST | `/mongo/currencies` | Создать валюту и первую запись истории (admin) |
| PUT | `/mongo/currencies/:id` | Обновить валюту и добавить запись истории (admin) |
| DELETE | `/mongo/currencies/:id` | Удалить и вернуть удалённый документ (admin) |
| POST | `/mongo/currencies/:id/history` | Добавить курс в массив и обновить текущий курс (admin) |
| PATCH | `/mongo/currencies/:id/history/:entryId` | Изменить заметку конкретной вложенной записи (admin) |

Для `POST`, `PUT`, `DELETE` и запросов к истории передайте `Authorization: Bearer <token>`. Токен получается через существующий `POST /auth/login` с данными администратора из PostgreSQL. MongoDB `_id` берите из ответа на создание или GET списка; `entryId` — из элемента `rateHistory`.

Примеры тел запросов для Postman:

```http
POST /mongo/currencies
{"code":"USD","name":"Доллар США","symbol":"$","rateToRub":92.5}

PUT /mongo/currencies/<id>
{"code":"USD","name":"Доллар США","symbol":"$","rateToRub":93.1}

POST /mongo/currencies/<id>/history
{"rateToRub":94.2,"source":"manual","note":"Проверка нового курса"}

PATCH /mongo/currencies/<id>/history/<entryId>
{"note":"Курс подтверждён"}
```

`PATCH` использует позиционный оператор MongoDB `$` для изменения поля внутри выбранного элемента массива. В Atlas Data Explorer или Compass откройте коллекцию `currencies`, чтобы увидеть `rateHistory` внутри документа. Модель находится в `models/mongoCurrency.js`, контроллер — в `controllers/mongoCurrencyController.js`, маршруты — в `routes/mongoCurrencyRoutes.js`.

## Запуск

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Перед первым запуском создайте файл `.env` в корне проекта:

```env
DATABASE_URL=postgres://postgres:ВАШ_ПАРОЛЬ@localhost:5432/currency_converter
JWT_SECRET=СЕКРЕТ_ДЛЯ_ПОДПИСИ_JWT
```

Сгенерировать надёжный секрет можно командой `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Файл `.env` уже добавлен в `.gitignore`, поэтому секреты не попадут в Git. Для Neon или Supabase используйте выданный сервисом URL. Сервер запускается на `http://localhost:3001` по умолчанию. Порт можно изменить через переменную окружения `PORT`.

Сервер разрешает CORS-запросы браузерного клиента. По умолчанию origin открыт; для ограничения укажите `CLIENT_ORIGIN=http://localhost:5173` в `.env` сервера (можно перечислить несколько origin через запятую).

Миграция создаёт таблицу пользователей. Регистрация всегда назначает роль `user`. Чтобы выдать административный доступ, сначала зарегистрируйте пользователя, затем выполните в PostgreSQL запрос, указав его email:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

После изменения роли заново войдите в систему; проверки административных прав выполняются по актуальной записи в БД.

Для демонстрации лабораторной №4 предусмотрены учетные записи `test@gmail.com` (роль `user`) и `admin@gmail.com` (роль `admin`), пароль обеих — `1`. Создать или обновить эти записи в подключенной PostgreSQL можно командой `npm run db:seed:demo-users`. Пароли сохраняются только в виде bcrypt-хеша. Эти учебные учетные данные нельзя использовать в production.

## Лабораторная работа №3: аутентификация и RBAC

Пользователи хранятся в таблице `users`. Модель `User` содержит уникальные `email`, `passwordHash` с bcrypt-хешем и `role`, по умолчанию `user`. Регистрация не позволяет выбрать административную роль. Пароли не возвращаются API в ответах.

При успешном входе сервер выдает подписанный JWT с `id` и `email`; срок действия токена — 1 час. JWT не шифрует payload, поэтому в него не помещаются пароли или другие секреты. Подпись создается секретом `JWT_SECRET` из `.env`. Клиент передает токен в заголовке `Authorization: Bearer <token>`.

### Примеры запросов

Регистрация:

```http
POST /auth/register
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "Example-Password-123"
}
```

Успешный ответ имеет статус `201` и содержит `id`, `email`, `role`.

Вход:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "Example-Password-123"
}
```

Ответ `200` содержит `token` и `expiresIn: "1h"`. Для защищенного профиля:

```http
GET /profile
Authorization: Bearer <token>
```

`GET /auth/profile` является алиасом. Профиль содержит `id`, `email`, `role` и `createdAt`, но не пароль и не его хеш.

### Доступ и статусы

`middleware/auth.js` содержит `authenticateToken`, который проверяет схему Bearer, подпись и срок действия JWT. При успехе claims записываются в `req.user`. Если токен отсутствует, неверен или просрочен, API отвечает `401 Unauthorized`. Дальнейшая проверка роли `requireAdmin` загружает пользователя из БД и разрешает административный маршрут только при `role = admin`; валидный токен пользователя с недостаточной ролью приводит к `403 Forbidden`.

Публичны чтение валют (`GET /currencies`, `GET /currencies/:id`) и конвертация (`POST /conversions`). Роль `admin` требуется для `POST /currencies/refresh`, `POST /currencies`, `PUT /currencies/:id` и `DELETE /currencies/:id`. После назначения или изменения роли достаточно повторно пройти JWT-аутентификацию; разрешение читается из БД при каждом административном запросе.

Для демонстрации регистрации и входа можно использовать Postman или Thunder Client. Затем скопировать выданный JWT в Bearer Authorization и вызвать `GET /profile`. Повторить запрос без Authorization: ожидается `401`. Вызов `POST /currencies/refresh` токеном обычного пользователя должен вернуть `403`; после назначения роли `admin` тот же защищенный запрос проходит проверку роли.

В проекте подготовлен отчет с теорией, точными листингами и перечнем требуемых иллюстраций: [REPORT_LAB3.txt](REPORT_LAB3.txt). Перед сдачей вставьте в него реальные скриншоты HTTP-запросов и ответов. Не включайте в скриншоты значение `JWT_SECRET`, пароль или другие секреты.

React-клиент, созданный в лабораторной №4, используется для интеграционной лабораторной №5 и находится в каталоге `лаба4`. Он обращается к этому серверу для получения списка валют и CRUD-операций. Инструкция с настройкой `VITE_API_URL`, запуском клиента и проверочными сценариями находится в [лаба4/README.md](лаба4/README.md).

## Маршруты

| Метод | URL | Назначение |
| --- | --- | --- |
| GET | `/currencies` | Получить все валюты |
| POST | `/currencies/refresh` | Загрузить актуальные курсы из ЦБ РФ |
| GET | `/currencies/:id` | Получить валюту по коду |
| POST | `/currencies` | Добавить валюту |
| PUT | `/currencies/:id` | Полностью обновить валюту |
| DELETE | `/currencies/:id` | Удалить валюту |
| POST | `/conversions` | Выполнить конвертацию по текущим курсам |
| POST | `/auth/register` | Зарегистрировать пользователя |
| POST | `/auth/login` | Войти и получить JWT на 1 час |
| GET | `/profile` | Получить профиль текущего пользователя (Bearer JWT) |
| GET | `/auth/profile` | Алиас маршрута профиля |

Создание, обновление и удаление валют, а также загрузка курсов (`POST /currencies`, `/currencies/:id`, `/currencies/refresh`) доступны только пользователям с ролью `admin`. Для защищённых запросов передавайте заголовок `Authorization: Bearer <token>`. Регистрация и вход доступны без токена.

Пример запроса конвертации:

```json
{
  "from": "USD",
  "to": "RUB",
  "amount": 100
}
```

{"id":"RRRR","name":"Test","symbol":"q","rateToRub":1}
