import clientPromise from "../lib/db";
import { Book } from "../lib/models/Book";
import { upsertBookRow } from "../lib/googleSheets";

// Разовая выгрузка уже существующих книг из MongoDB в Google Таблицу.
// Нужно запустить один раз после настройки синхронизации (GOOGLE_SHEET_ID,
// GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY в .env.local),
// чтобы таблица не оказалась пустой при первом включении.
//
// Запуск: npx tsx scripts/export-books-to-sheet.ts

async function exportBooksToSheet() {
  try {
    const client = await clientPromise;
    const db = client.db("library");

    const books = await db.collection<Book>("books").find({}).toArray();

    console.log(`Найдено книг: ${books.length}. Начинаю выгрузку в таблицу...`);

    let done = 0;
    for (const book of books) {
      await upsertBookRow(book as Book & { _id: import("mongodb").ObjectId });
      done += 1;
      if (done % 20 === 0) {
        console.log(`  ${done}/${books.length}...`);
      }
    }

    console.log(`Готово. Выгружено книг: ${done}`);
    process.exit(0);
  } catch (error) {
    console.error("Ошибка выгрузки в таблицу:", error);
    process.exit(1);
  }
}

exportBooksToSheet();