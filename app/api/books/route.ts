import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { Book, BookCreate, buildLanguageDetails } from "@/lib/models/Book";
import { syncReferenceData } from "@/lib/syncReferenceData";
import { upsertBookRow } from "@/lib/googleSheets";

// GET /api/books?q=...&tag=...&lang=...
//
// tag и lang могут содержать несколько значений через запятую:
// ?tag=история,научпоп
// ?lang=ckt,kpy,itl
//
// Книга подходит, если содержит ХОТЯ БЫ ОДИН
// из выбранных тегов/языков.

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("library");

    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get("q") || "";
    const tagParam = searchParams.get("tag") || "";
    const langParam = searchParams.get("lang") || "";

    const userEmail = request.headers.get("email");

    // Преобразуем строки:
    // "история,научпоп" -> ["история", "научпоп"]
    const selectedTags = tagParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const selectedLanguages = langParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const andConditions: Record<string, unknown>[] = [];

    // Поиск
    if (query) {
      andConditions.push({
        $or: [
          { title: { $regex: query, $options: "i" } },
          { author: { $regex: query, $options: "i" } },
          { publisher_year: { $regex: query, $options: "i" } },
          { tags: { $regex: query, $options: "i" } },
          { languages: { $regex: query, $options: "i" } },
        ],
      });
    }

    // Несколько тегов:
    // книга подходит, если у неё есть ХОТЯ БЫ ОДИН
    // из выбранных тегов.
    if (selectedTags.length > 0) {
      andConditions.push({
        tags: {
          $in: selectedTags,
        },
      });
    }

    // Несколько языков:
    // книга подходит, если у неё есть ХОТЯ БЫ ОДИН
    // из выбранных языков.
    if (selectedLanguages.length > 0) {
      andConditions.push({
        languageCodes: {
          $in: selectedLanguages,
        },
      });
    }

    const filter =
      andConditions.length > 0
        ? { $and: andConditions }
        : {};

    // Определяем, админ ли пользователь.
    let isAdmin = false;

    if (userEmail) {
      const user = await db
        .collection("users")
        .findOne({
          email: userEmail,
        });

      isAdmin = user?.isAdmin === true;
    }

    // Админ получает больше книг.
    // Обычный пользователь получает 8.
    const limit = isAdmin ? 100 : 8;

    const books = await db
      .collection<Book>("books")
      .find(filter)
      .sort({ title: 1 })
      .limit(limit)
      .toArray();

    // Для админа добавляем информацию
    // о пользователе, который взял книгу.
    if (isAdmin) {
      const users = await db
        .collection("users")
        .find({
          borrowedBooks: {
            $in: books
              .map((book) => book._id)
              .filter(Boolean),
          },
        })
        .project({
          email: 1,
          firstName: 1,
          lastName: 1,
          telegram: 1,
          borrowedBooks: 1,
        })
        .toArray();

      const booksWithBorrower = books.map(
        (book) => {
          const borrower = users.find(
            (user) =>
              user.borrowedBooks?.some(
                (id: ObjectId) =>
                  id.equals(book._id!)
              )
          );

          return {
            ...book,
            borrower: borrower
              ? {
                  email: borrower.email,
                  firstName:
                    borrower.firstName,
                  lastName:
                    borrower.lastName,
                  telegram:
                    borrower.telegram,
                }
              : null,
          };
        }
      );

      return NextResponse.json({
        books: booksWithBorrower,
      });
    }

    return NextResponse.json({
      books,
    });
  } catch (error) {
    console.error(
      "Books API error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}

// POST /api/books
//
// Добавляет новую книгу.
// После добавления автоматически пересобираются
// коллекции tags и languages.

export async function POST(
  request: NextRequest
) {
  try {
    const client = await clientPromise;
    const db = client.db("library");

    const data =
      (await request.json()) as BookCreate;

    // Проверяем обязательные поля.
    if (!data.title) {
      return NextResponse.json(
        {
          error: "Название книги обязательно",
        },
        {
          status: 400,
        }
      );
    }

    const tags = data.tags || [];
    const languages = data.languages || [];
    const languageCodes = data.languageCodes || [];

    const book: Book = {
      ...data,
      tags,
      languages,
      languageCodes,
      languageDetails: buildLanguageDetails(languages, languageCodes),
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await db
      .collection<Book>("books")
      .insertOne(book);

    // Синхронизируем теги и языки
    // после добавления книги.
    await syncReferenceData();

    // Отражаем новую книгу в Google Таблице
    // (не блокирует ответ при ошибке синка).
    await upsertBookRow({ ...book, _id: result.insertedId });

    return NextResponse.json(
      {
        _id: result.insertedId,
        ...book,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create book error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}