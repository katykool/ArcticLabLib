import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("library");

    // Проверяем администратора по cookie
    const userEmail =
      request.cookies.get("user_email")?.value ||
      request.headers.get("email");

    if (!userEmail) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.collection("users").findOne({
      email: userEmail,
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const now = new Date();

    // Берём только книги, которые сейчас находятся у пользователей.
    // active — срок ещё не истёк.
    // overdue — срок уже истёк.
    const borrows = await db
      .collection("borrows")
      .aggregate([
        {
          $match: {
            status: {
              $in: ["active", "overdue"],
            },
          },
        },
        {
          $lookup: {
            from: "books",
            localField: "bookId",
            foreignField: "_id",
            as: "book",
          },
        },
        {
          $unwind: {
            path: "$book",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $addFields: {
            calculatedStatus: {
              $cond: [
                { $lt: ["$dueDate", now] },
                "overdue",
                "active",
              ],
            },
          },
        },
        {
          $sort: {
            calculatedStatus: -1,
            dueDate: 1,
          },
        },
      ])
      .toArray();

    return NextResponse.json({
      borrows,
    });
  } catch (error) {
    console.error("Admin borrows error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}