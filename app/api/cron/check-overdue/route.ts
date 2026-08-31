import { NextRequest, NextResponse } from "next/server";

import { ObjectId } from "mongodb";

import clientPromise from "@/lib/db";

import {
  Book,
  BookCreate,
  buildLanguageDetails,
} from "@/lib/models/Book";

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

    const userEmail =
      request.cookies.get("user_email")?.value ||
      request.headers.get("email");

    // "история,научпоп"
    // ->
    // ["история", "научпоп"]

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
          {
            title: {
              $regex: query,
              $options: "i",
            },
          },
          {
            author: {
              $regex: query,
              $options: "i",
            },
          },
          {
            publisher_year: {
              $regex: query,
              $options: "i",
            },
          },
          {
            tags: {
              $regex: query,
              $options: "i",
            },
          },
          {
            languages: {
              $regex: query,
              $options: "i",
            },
          },
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

    // Определяем текущего пользователя.

    let isAdmin = false;
    let currentUser = null;

    if (userEmail) {
      currentUser = await db
        .collection("users")
        .findOne({
          email: userEmail,
        });

      isAdmin = currentUser?.isAdmin === true;
    }

    // Обычный пользователь получает 8 книг.
    // Админ получает до 100 книг.

    const limit = isAdmin ? 100 : 8;

    const books = await db
      .collection<Book>("books")
      .find(filter)
      .sort({ title: 1 })
      .limit(limit)
      .toArray();

    // ============================================================
    // Обычный пользователь
    // ============================================================

    if (!isAdmin) {
      // Если пользователь не авторизован,
      // просто возвращаем книги.

      if (!currentUser?._id) {
        return NextResponse.json({
          books: books.map((book) => ({
            ...book,
            isUserBook: false,
          })),
        });
      }

      const userId = currentUser._id;

      // Получаем текущие выдачи пользователя.
      //
      // Важно: учитываем и active, и overdue.

      const userBorrows = await db
        .collection("borrows")
        .find({
          userId,
          status: {
            $in: ["active", "overdue"],
          },
        })
        .toArray();

      // Создаём Map:
      //
      // bookId -> borrow
      //
      // Так мы быстро найдём срок возврата
      // конкретной книги.

      const userBorrowMap = new Map<
        string,
        any
      >();

      userBorrows.forEach((borrow: any) => {
        if (borrow.bookId) {
          userBorrowMap.set(
            borrow.bookId.toString(),
            borrow
          );
        }
      });

      const booksWithUserInfo = books.map(
        (book) => {
          const bookId =
            book._id?.toString();

          const borrow = bookId
            ? userBorrowMap.get(bookId)
            : undefined;

          // Эта книга взята текущим пользователем.

          if (borrow) {
            return {
              ...book,

              // Используется BookCard
              // для кнопки "Вернуть книгу"
              // и надписи "Ваша книга".

              isUserBook: true,

              // Книга фактически выдана.

              isAvailable: false,

              // Срок возврата.

              dueDate: borrow.dueDate
                ? new Date(
                    borrow.dueDate
                  ).toISOString()
                : undefined,

              // active или overdue

              borrowStatus: borrow.status,
            };
          }

          return {
            ...book,
            isUserBook: false,
          };
        }
      );

      return NextResponse.json({
        books: booksWithUserInfo,
      });
    }

    // ============================================================
    // Админ
    // ============================================================

    // Получаем активные и просроченные выдачи
    // для отображаемых книг.

    const bookIds = books
      .map((book) => book._id)
      .filter(
        (id): id is ObjectId =>
          Boolean(id)
      );

    const borrows =
      bookIds.length > 0
        ? await db
            .collection("borrows")
            .find({
              bookId: {
                $in: bookIds,
              },
              status: {
                $in: ["active", "overdue"],
              },
            })
            .toArray()
        : [];

    // Загружаем пользователей,
    // которые сейчас имеют книги.

    const users = await db
      .collection("users")
      .find({
        borrowedBooks: {
          $in: bookIds,
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
        const bookId =
          book._id?.toString();

        // Находим текущую выдачу этой книги.

        const borrow = borrows.find(
          (item: any) =>
            item.bookId?.toString() ===
            bookId
        );

        // Находим пользователя.

        const borrower = borrow
          ? users.find(
              (user: any) =>
                user._id?.toString() ===
                borrow.userId?.toString()
            )
          : users.find(
              (user: any) =>
                user.borrowedBooks?.some(
                  (id: ObjectId) =>
                    id.equals(book._id!)
                )
            );

        return {
          ...book,

          // Если книга сейчас выдана,
          // она недоступна.

          isAvailable: borrow
            ? false
            : book.isAvailable,

          // Информация о читателе.

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

          // Срок возврата.

          dueDate: borrow?.dueDate
            ? new Date(
                borrow.dueDate
              ).toISOString()
            : undefined,

          // active / overdue

          borrowStatus:
            borrow?.status || undefined,
        };
      }
    );

    return NextResponse.json({
      books: booksWithBorrower,
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

// ============================================================
// POST /api/books
// ============================================================
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
          error:
            "Название книги обязательно",
        },
        {
          status: 400,
        }
      );
    }

    const tags = data.tags || [];
    const languages =
      data.languages || [];
    const languageCodes =
      data.languageCodes || [];

    const book: Book = {
      ...data,

      tags,
      languages,
      languageCodes,

      languageDetails:
        buildLanguageDetails(
          languages,
          languageCodes
        ),

      isAvailable: true,

      createdAt: new Date(),
    };

    // Создаём запись книги.

    const result = await db
      .collection<Book>("books")
      .insertOne(book);

    // Синхронизируем теги и языки.

    await syncReferenceData();

    // Отражаем новую книгу
    // в Google Таблице.

    await upsertBookRow({
      ...book,
      _id: result.insertedId,
    });

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