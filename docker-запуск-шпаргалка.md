# Как запустить arctic-biblo (шпаргалка)

Проект: `C:\Users\katyk\Downloads\arctic-biblo`
Сеть: `arctic-net`
Контейнер с базой: `some-mongo`

## Каждый раз, когда нужно запустить проект

### 1. Поднять MongoDB

```cmd
docker start some-mongo
```

Если ругается, что не в сети — подключить:

```cmd
docker network connect arctic-net some-mongo
```

(если сеть `arctic-net` вообще не существует — создать её один раз: `docker network create arctic-net`)

### 2. Проверить, не занят ли порт 3000

Если раньше уже был запущен контейнер с приложением и не остановлен — новый не запустится ("port is already allocated"). Посмотреть:

```cmd
docker ps
```

Если видишь старый контейнер с `node` и портом 3000 — остановить его:

```cmd
docker stop <CONTAINER_ID>
```

### 3. Перейти в папку проекта и запустить контейнер с приложением

```cmd
cd C:\Users\katyk\Downloads\arctic-biblo
docker run --rm -it --network arctic-net -p 3000:3000 -v "%cd%":/app -w /app node:24-slim bash
```

### 4. Внутри контейнера (та же чёрная консоль, но уже "root@...:/app#")

Если это первый запуск / после `npm install` ничего не менялось — можно сразу:

```bash
npm run dev
```

Если только что склонировала проект заново или обновляла зависимости:

```bash
npm install
npm run dev
```

Если нужно занести данные книг в базу заново (обычно один раз):

```bash
npx tsx scripts/csv-to-mongo.ts
```

### 5. Открыть в браузере

[http://localhost:3000](http://localhost:3000)

### 6. Чтобы остановить

В консоли с `npm run dev` — `Ctrl+C`, потом `exit` (контейнер приложения удалится сам, `--rm`). Mongo можно оставить работать (`some-mongo`) или остановить:

```cmd
docker stop some-mongo
```

---

## Если что-то не так — проверить

**Мongo и приложение видят друг друга?**

```cmd
docker network inspect arctic-net
```

Оба контейнера (`some-mongo` и текущий контейнер приложения) должны быть в списке `Containers`.

**В `.env.local` должно быть:**

```
MONGODB_URI=mongodb://some-mongo:27017/library
```

(именно `some-mongo`, не `localhost` — потому что приложение и база в разных контейнерах)

**Порт 3000 занят чем-то старым?**

```cmd
docker ps
```

и остановить лишнее.
