import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { Book } from "@/lib/models/Book";

// GET /api/books/sorted
//
// Параметры:
//
// q=...                       поиск
// tag=история,научпоп         несколько тегов
// lang=ckt,kpy,itl            несколько языков
// page=1                      страница
//
// Сортировка:
//
// 1. Книги, которые взял текущий пользователь
// 2. Остальные книги
//
// Внутри каждой группы — по алфавиту.

export async function GET(
  request: NextRequest
) {
  try {
    const client = await clientPromise;
    const db = client.db("library");

    const searchParams =
      request.nextUrl.searchParams;

    const query =
      searchParams.get("q") || "";

    const tagParam =
      searchParams.get("tag") || "";

    const langParam =
      searchParams.get("lang") || "";

    const page = Math.max(
      1,
      parseInt(
        searchParams.get("page") || "1",
        10
      )
    );

    const limit = 12;

    const skip = (page - 1) * limit;

    // -----------------------------------------------------
    // Несколько тегов
    // -----------------------------------------------------

    const selectedTags = tagParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    // -----------------------------------------------------
    // Несколько языков
    // -----------------------------------------------------

    const selectedLanguages = langParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    // -----------------------------------------------------
    // Пользователь
    // -----------------------------------------------------

    const userEmail =
      request.headers.get("email");

    let userBorrowedBookIds: ObjectId[] = [];

    if (userEmail) {
      const user = await db
        .collection("users")
        .findOne({
          email: userEmail,
        });

      userBorrowedBookIds =
        (user?.borrowedBooks || []) as ObjectId[];
    }

    // -----------------------------------------------------
    // Формируем фильтр
    // -----------------------------------------------------

    const andConditions: Record<
      string,
      unknown
    >[] = [];

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

    // -----------------------------------------------------
    // Фильтр по нескольким тегам
    //
    // $in означает:
    //
    // книга имеет ХОТЯ БЫ ОДИН
    // выбранный тег.
    // -----------------------------------------------------

    if (selectedTags.length > 0) {
      andConditions.push({
        tags: {
          $in: selectedTags,
        },
      });
    }

    // -----------------------------------------------------
    // Фильтр по нескольким языкам
    //
    // Книга имеет ХОТЯ БЫ ОДИН
    // выбранный язык.
    // -----------------------------------------------------

    if (selectedLanguages.length > 0) {
      andConditions.push({
        languageCodes: {
          $in: selectedLanguages,
        },
      });
    }

    const filter =
      andConditions.length > 0
        ? {
            $and: andConditions,
          }
        : {};

    // -----------------------------------------------------
    // Получаем ВСЕ подходящие книги
    //
    // Нам нужно получить их целиком,
    // потому что сначала необходимо разделить
    // книги пользователя и остальные.
    // -----------------------------------------------------

    const allBooks = await db
      .collection<Book>("books")
      .find(filter)
      .toArray();

    // -----------------------------------------------------
    // Добавляем информацию:
    //
    // является ли книга взятой пользователем.
    // -----------------------------------------------------

    const booksWithUserInfo =
      allBooks.map((book) => ({
        ...book,

        isUserBook:
          book._id
            ? userBorrowedBookIds.some(
                (id) =>
                  id.equals(book._id!)
              )
            : false,
      }));

    // -----------------------------------------------------
    // Разделяем книги
    // -----------------------------------------------------

    const userBooks =
      booksWithUserInfo.filter(
        (book) => book.isUserBook
      );

    const otherBooks =
      booksWithUserInfo.filter(
        (book) => !book.isUserBook
      );

    // -----------------------------------------------------
    // Сортировка по названию
    // -----------------------------------------------------

    userBooks.sort((a, b) =>
      a.title.localeCompare(
        b.title,
        "ru"
      )
    );

    otherBooks.sort((a, b) =>
      a.title.localeCompare(
        b.title,
        "ru"
      )
    );

    // -----------------------------------------------------
    // Сначала книги пользователя,
    // потом остальные.
    // -----------------------------------------------------

    const sortedBooks = [
      ...userBooks,
      ...otherBooks,
    ];

    // -----------------------------------------------------
    // Пагинация
    // -----------------------------------------------------

    const paginatedBooks =
      sortedBooks.slice(
        skip,
        skip + limit
      );

    const total =
      sortedBooks.length;

    const totalPages =
      Math.ceil(total / limit);

    return NextResponse.json({
      books: paginatedBooks,

      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,

        hasNext:
          page < totalPages,

        hasPrev:
          page > 1,
      },
    });
  } catch (error) {
    console.error(
      "Sorted books API error:",
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
