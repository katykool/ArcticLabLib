import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { Book, buildLanguageDetails } from "@/lib/models/Book";
import { syncReferenceData } from "@/lib/syncReferenceData";

// POST /api/sheets/webhook
// Вызывается Google Apps Script (см. триггер onEdit в таблице) при
// изменении строки. Тело запроса — данные строки в виде JSON:
// {
//   secret: "...",
//   id: "<_id книги или пусто, если строка новая>",
//   "автор": "...", "название": "...", "издательство, год": "...",
//   "тэг": "тег1, тег2", "тип": "...", "где": "...",
//   "язык": "язык1, язык2", "код": "код1, код2"
// }
//
// Если id пустой — создаётся новая книга, и её _id возвращается в ответе,
// чтобы Apps Script дописал его в скрытую колонку A той же строки.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !process.env.SHEETS_WEBHOOK_SECRET ||
      body.secret !== process.env.SHEETS_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const title = String(body["название"] || "").trim();
    if (!title) {
      return NextResponse.json(
        { error: "Название обязательно" },
        { status: 400 }
      );
    }

    const tags = splitList(body["тэг"]);
    const languages = splitList(body["язык"]);
    const languageCodes = splitList(body["код"]);

    const client = await clientPromise;
    const db = client.db("library");

    const fields = {
      author: body["автор"] ? String(body["автор"]) : undefined,
      title,
      publisher_year: body["издательство, год"]
        ? String(body["издательство, год"])
        : undefined,
      publicationType: body["тип"] ? String(body["тип"]) : undefined,
      location: body["где"] ? String(body["где"]) : undefined,
      tags,
      languages,
      languageCodes,
      languageDetails: buildLanguageDetails(languages, languageCodes),
    };

    const idStr = String(body.id || "").trim();

    if (idStr) {
      if (!ObjectId.isValid(idStr)) {
        return NextResponse.json(
          { error: "Некорректный id" },
          { status: 400 }
        );
      }

      const result = await db
        .collection<Book>("books")
        .updateOne({ _id: new ObjectId(idStr) }, { $set: fields });

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { error: "Книга не найдена" },
          { status: 404 }
        );
      }

      await syncReferenceData();
      return NextResponse.json({ ok: true, _id: idStr });
    }

    // Новая строка без id — создаём книгу.
    const newBook: Book = {
      ...fields,
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await db.collection<Book>("books").insertOne(newBook);
    await syncReferenceData();

    return NextResponse.json({
      ok: true,
      _id: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Sheets webhook error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}