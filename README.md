# arctic-biblo
 
Библиотечная система для Арктической лаборатории на Next.js + MongoDB: каталог книг с тегами и языками, текстовый поиск, фильтрация, дерево языковых семей и админ-панель для управления фондом.
 
## Стек
 
- **Next.js 15** (App Router, Turbopack) + **React 19**, TypeScript
- **MongoDB** / **Mongoose**
- **NextAuth** — авторизация
- **Tailwind CSS 4** + **shadcn/ui** (Radix UI, `class-variance-authority`, `tailwind-merge`)
- **Nodemailer** — почтовые уведомления
- **Google APIs** (`googleapis`) — интеграция с Google Sheets
- **csv-parse / csv-parser** — импорт данных из CSV
## Возможности
 
### Модель книги (`lib/models/Book.ts`)
 
- `tags: string[]` — у книги может быть несколько тегов;
- `languages: string[]`, `languageCodes: string[]`, `languageDetails: LanguageDetail[]` — у книги может быть несколько языков, с сохранением порядка и признаком основного языка (`isPrimary`).
### Справочные коллекции
 
Собираются импорт-скриптом на основе данных о книгах:
 
- `languages` — статистика по языкам (`lib/models/Language.ts`, `/api/languages`);
- `tags` — статистика по темам (`lib/models/Tag.ts`, `/api/tags`);
- `language_tree` — плоское представление дерева языковых семей (`lib/models/LanguageTreeNode.ts`, `/api/languages/tree`), собирается из `scripts/language_tree.json`. Поддерживает поиск книг по всей языковой семье/группе через `$graphLookup` (например, все книги на любом уральском языке).
### API
 
- `GET /api/books`, `GET /api/books/sorted` — список/поиск книг; принимают `?tag=`, `?lang=` и `?q=`, фильтруя по массивам `tags[]` / `languageCodes[]`; параметры комбинируются.
- `GET /api/tags`, `GET /api/languages` — справочники для UI-фильтров.
- `GET /api/languages/tree` — без `code` отдаёт всё дерево, с `code=xxx` — узел + все книги на этом языке и его языках-потомках.
### UI
 
- `BookCard` — карточка книги с бейджами всех её тегов и языков.
- `TagLanguageFilter` — фильтр по тегу/языку с выпадающими списками (данные из `/api/tags`, `/api/languages`); выбор пишется в URL (`?tag=&lang=`), сохраняется при пагинации и работает вместе с текстовым поиском.
- `SearchBar` — текстовый поиск по книгам.
- Админ-панель (`AdminContent.tsx`) — CRUD книг с полями «Теги», «Языки», «Коды языков» (через запятую).
### Импорт данных (`scripts/csv-to-mongo.ts`)
 
Скрипт на TypeScript:
 
1. Читает `scripts/books.csv` (данные библиотеки), разбирает столбцы `тэг`, `язык`, `код` (значения через запятую) в массивы.
2. Загружает книги в коллекцию `books`, создаёт индексы (включая полнотекстовый).
3. Собирает `languages` и `tags` из загруженных книг (агрегация по `languageCodes` / `tags`).
4. Разворачивает `scripts/language_tree.json` в плоскую коллекцию `language_tree`.
Запуск:
 
```bash
npx tsx scripts/csv-to-mongo.ts
```
 
(нужен `MONGODB_URI` в `.env.local`, указывающий на базу `library`)
 
## Требования
 
- Node.js 20+
- Доступ к экземпляру MongoDB (локальному или облачному, например MongoDB Atlas)
## Установка и запуск
 
```bash
git clone https://github.com/katykool/ArcticLabLib.git
cd ArcticLabLib
npm install
cp .env.example .env.local   # заполнить переменные окружения (см. ниже)
npx tsx scripts/csv-to-mongo.ts   # первичный импорт данных из scripts/books.csv
npm run dev
```
 
Приложение будет доступно на [http://localhost:3000](http://localhost:3000).
 
### Переменные окружения (`.env.local`)
 
```
MONGODB_URI=mongodb://localhost:27017/library
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
 
EMAIL_HOST=smtp.yandex.ru
EMAIL_PORT=465
EMAIL_USER=
EMAIL_PASS=
ADMIN_EMAIL=
 
GOOGLE_SHEET_ID=
GOOGLE_SHEET_NAME=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
SHEETS_WEBHOOK_SECRET=
```
 
| Переменная | Назначение |
| --- | --- |
| `MONGODB_URI` | строка подключения к MongoDB (база `library`) |
| `NEXTAUTH_URL` | базовый URL приложения, используется NextAuth |
| `NEXTAUTH_SECRET` | секрет для подписи сессий/токенов NextAuth |
| `EMAIL_HOST`, `EMAIL_PORT` | адрес и порт SMTP-сервера для Nodemailer |
| `EMAIL_USER`, `EMAIL_PASS` | учётные данные почтового ящика, от имени которого отправляются письма |
| `ADMIN_EMAIL` | адрес администратора — получателя уведомлений |
| `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_NAME` | ID и название листа Google Sheets, с которым синхронизируется библиотека |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | учётные данные сервисного аккаунта Google для доступа к Google Sheets API |
| `SHEETS_WEBHOOK_SECRET` | секрет для проверки подлинности вебхуков от Google Sheets |
 
> `EMAIL_PASS` — это пароль приложения (app password) почтового сервиса, а не обычный пароль от почты. `GOOGLE_PRIVATE_KEY` в `.env` обычно хранится в виде однострочной строки с `\n` вместо переносов строк.
 
### Доступные npm-скрипты
 
| Команда | Описание |
| --- | --- |
| `npm run dev` | запуск в режиме разработки (Turbopack) |
| `npm run build` | production-сборка (Turbopack) |
| `npm run start` | запуск собранного приложения |
 
## Структура проекта
 
```
app/
  (public)/page.tsx          — главная страница со списком книг, поиском и фильтрами
  admin/page.tsx              — админ-панель
  api/books/                  — CRUD + поиск/фильтрация книг
  api/tags/                   — справочник тегов
  api/languages/               — справочник языков
  api/languages/tree/          — иерархический поиск по дереву языков
components/
  BookCard.tsx                 — карточка книги (теги + языки как бейджи)
  TagLanguageFilter.tsx        — фильтр по тегу/языку
  SearchBar.tsx                — текстовый поиск
  AdminContent.tsx             — админ-панель (CRUD книг)
lib/models/
  Book.ts                      — книга (tags[], languages[], languageCodes[], languageDetails[])
  Tag.ts, Language.ts          — справочные коллекции
  LanguageTreeNode.ts          — узел дерева языковых семей
scripts/
  csv-to-mongo.ts              — импорт CSV → MongoDB + пересборка справочников
  books.csv                    — данные библиотеки
  language_tree.json           — дерево языковых семей
```

### To Upgrade:
* орфография
* полное имя авторов

https://docs.google.com/spreadsheets/d/1AGiYkbGa1Q16PDRB0-_5JEZguDm_OYzVMNXlK5z-254/edit?gid=0#gid=0

https://script.google.com/u/0/home/projects/1tYEiv6lSosk6DrmG5eS2tvHx0yHZpcM3guml15z3TQP70HZJFkUaFwB5/edit
