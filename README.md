# arctic-biblo

Библиотечная система для Арктической лаборатории — объединяет:

- **фронтенд и логику выдачи книг** из [redisks/biblo](https://github.com/redisks/biblo) (Next.js, MongoDB, авторизация, выдача/возврат книг, админ-панель);
- **структуру данных и таксономию** из [katykool/arcticlab_lib](https://github.com/katykool/arcticlab_lib) (множественные теги и языки на книгу, иерархическое дерево языковых семей, справочные коллекции).

## Что изменилось относительно исходного biblo

### Модель книги (`lib/models/Book.ts`)
Раньше у книги было одно поле `category`. Теперь:
- `tags: string[]` — может быть несколько тегов;
- `languages: string[]`, `languageCodes: string[]`, `languageDetails: LanguageDetail[]` — может быть несколько языков, с сохранением порядка и признаком основного языка (`isPrimary`).

### Новые справочные коллекции (пересобираются импорт-скриптом)
- `languages` — статистика по языкам (`lib/models/Language.ts`, `/api/languages`);
- `tags` — статистика по темам (`lib/models/Tag.ts`, `/api/tags`);
- `language_tree` — плоское представление дерева языковых семей (`lib/models/LanguageTreeNode.ts`, `/api/languages/tree`), собирается из `scripts/language_tree.json`. Поддерживает поиск книг по всей языковой семье/группе через `$graphLookup` (например, все книги на любом уральском языке).

### API
- `GET /api/books`, `GET /api/books/sorted` — теперь принимают `?tag=` и `?lang=` в дополнение к `?q=`, фильтруя по массивам `tags[]`/`languageCodes[]`; параметры комбинируются.
- `GET /api/tags`, `GET /api/languages` — справочники для UI-фильтров.
- `GET /api/languages/tree` — без `code` отдаёт всё дерево, с `code=xxx` — узел + все книги на этом языке и его языках-потомках.

### UI
- `BookCard` — вместо одной рубрики показывает бейджи всех тегов и языков книги.
- `TagLanguageFilter` — новый компонент с выпадающими списками тегов/языков (данные из `/api/tags`, `/api/languages`), пишет выбор в URL (`?tag=&lang=`), сохраняется при пагинации и работает вместе с текстовым поиском.
- Админ-панель (`AdminContent.tsx`) — поля «Теги», «Языки», «Коды языков» (через запятую) вместо «Рубрика», как при добавлении, так и при редактировании книги.

### Импорт данных (`scripts/csv-to-mongo.ts`)
Полностью переписан: логика `CSVBook` / `parse_languages_with_codes` / `transform_books` / `create_collections` из `books_mongo_arcticlab.ipynb` перенесена на TypeScript. Скрипт:
1. Читает `scripts/books.csv` (реальные данные библиотеки), разбирает столбцы `тэг`, `язык`, `код` (значения через запятую) в массивы.
2. Загружает книги в коллекцию `books`, создаёт индексы (включая полнотекстовый).
3. Пересобирает `languages` и `tags` из уже загруженных книг (агрегация по `languageCodes`/`tags`).
4. Разворачивает `scripts/language_tree.json` в плоскую коллекцию `language_tree`.

Запуск:
```bash
npx tsx scripts/csv-to-mongo.ts
```
(нужен `MONGODB_URI` в `.env.local`, указывающий на базу `library`)

## Запуск проекта

```bash
npm install
cp .env.example .env.local   # заполнить MONGODB_URI и остальные переменные
npx tsx scripts/csv-to-mongo.ts   # первичный импорт данных
npm run dev
```

## Структура

```
app/
  (public)/page.tsx          — главная страница со списком книг, поиском и фильтрами
  admin/page.tsx             — админ-панель
  api/books/                 — CRUD + поиск/фильтрация книг
  api/tags/                  — справочник тегов
  api/languages/             — справочник языков
  api/languages/tree/        — иерархический поиск по дереву языков
components/
  BookCard.tsx                — карточка книги (теги + языки как бейджи)
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
