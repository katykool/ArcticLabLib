import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { Book } from "@/lib/models/Book";

// GET /api/books/sorted?q=...&tag=...&lang=...&page=1
// Книги пользователя идут первыми, затем остальные (по алфавиту).
// tag  — фильтр по тегу (tags[])
// lang — фильтр по коду языка (languageCodes[])
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("library");
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    const lang = searchParams.get("lang") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 12;
    const skip = (page - 1) * limit;

    const userEmail = request.headers.get("email");

    let userBorrowedBookIds: ObjectId[] = [];
    if (userEmail) {
      const user = await db.collection("users").findOne({ email: userEmail });
      userBorrowedBookIds = user?.borrowedBooks || [];
    }

    const andConditions: Record<string, unknown>[] = [];

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

    if (tag) {
      andConditions.push({ tags: tag });
    }

    if (lang) {
      andConditions.push({ languageCodes: lang });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    // Получаем ВСЕ подходящие книги для сортировки
    const allBooks = await db.collection<Book>("books").find(filter).toArray();

    // Добавляем информацию о принадлежности и сортируем
    const booksWithUserInfo = allBooks.map((book) => ({
      ...book,
      isUserBook: userBorrowedBookIds.some((id) => id.equals(book._id!)),
    }));

    // Сначала книги пользователя, потом остальные
    const userBooks = booksWithUserInfo.filter((book) => book.isUserBook);
    const otherBooks = booksWithUserInfo.filter((book) => !book.isUserBook);

    userBooks.sort((a, b) => a.title.localeCompare(b.title));
    otherBooks.sort((a, b) => a.title.localeCompare(b.title));

    const sortedBooks = [...userBooks, ...otherBooks];

    const paginatedBooks = sortedBooks.slice(skip, skip + limit);
    const total = sortedBooks.length;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      books: paginatedBooks,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Sorted books API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
