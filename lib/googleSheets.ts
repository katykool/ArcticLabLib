import { google } from "googleapis";
import { ObjectId } from "mongodb";
import { Book } from "./models/Book";

// Двусторонняя синхронизация с Google Таблицей.
// Колонки листа (строка 1 — заголовки):
// A: _id (служебная, скрытая) | B: автор | C: название |
// D: издательство, год | E: тэг | F: тип | G: где |
// H: язык | I: код
//
// Сопоставление "строка таблицы <-> книга в MongoDB" идёт по _id в колонке A,
// а не по номеру строки — так строки можно свободно переставлять/сортировать
// в таблице без риска перепутать записи.

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Книги";

function isConfigured() {
  return Boolean(
    SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function joinList(values?: string[]) {
  return (values || []).join(", ");
}

function bookToRow(book: Book & { _id: ObjectId }): string[] {
  return [
    book._id.toString(),
    book.author || "",
    book.title,
    book.publisher_year || "",
    joinList(book.tags),
    book.publicationType || "",
    book.location || "",
    joinList(book.languages),
    joinList(book.languageCodes),
  ];
}

async function findRowNumberById(
  sheets: ReturnType<typeof getSheetsClient>,
  bookId: string
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:A`,
  });
  const ids = (res.data.values || []).map((row) => row[0]);
  const idx = ids.indexOf(bookId);
  // +2: пропускаем строку заголовка (1) и переходим от индекса массива (0) к номеру строки
  return idx === -1 ? null : idx + 2;
}

// Создаёт или обновляет строку книги в таблице. Не бросает исключение наружу —
// ошибка синхронизации с таблицей не должна ронять основной запрос к сайту.
export async function upsertBookRow(book: Book & { _id: ObjectId }) {
  if (!isConfigured()) return;

  try {
    const sheets = getSheetsClient();
    const row = bookToRow(book);
    const rowNumber = await findRowNumberById(sheets, book._id.toString());

    if (rowNumber === null) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:I${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    }
  } catch (error) {
    console.error("Google Sheets sync (upsert) error:", error);
  }
}

// Очищает строку книги в таблице (не удаляет физически строку листа, чтобы не
// сбивать нумерацию соседних строк во время параллельного редактирования).
export async function clearBookRow(bookId: string) {
  if (!isConfigured()) return;

  try {
    const sheets = getSheetsClient();
    const rowNumber = await findRowNumberById(sheets, bookId);
    if (rowNumber === null) return;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:I${rowNumber}`,
    });
  } catch (error) {
    console.error("Google Sheets sync (clear) error:", error);
  }
}