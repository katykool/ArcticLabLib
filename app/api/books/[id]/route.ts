import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { Book } from "@/lib/models/Book";
import { syncReferenceData } from "@/lib/syncReferenceData";

// GET /api/books/[id]
// Получить одну книгу
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("library");

    const book = await db
      .collection<Book>("books")
      .findOne({
        _id: new ObjectId(id),
      });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error("Get book error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PUT /api/books/[id]
// Изменить книгу
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("library");

    const updateData = await request.json();

    // Не позволяем случайно изменить _id
    delete updateData._id;

    // Обновляем дату изменения
    updateData.updatedAt = new Date();

    const result = await db
      .collection<Book>("books")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    // После изменения книги пересобираем
    // теги и языки.
    await syncReferenceData();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Update book error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE /api/books/[id]
// Удалить книгу
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("library");

    const result = await db
      .collection<Book>("books")
      .deleteOne({
        _id: new ObjectId(id),
      });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    // После удаления книги пересобираем
    // теги и языки.
    await syncReferenceData();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete book error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
