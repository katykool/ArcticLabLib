import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/db'
import { Book, BookCreate } from '@/lib/models/Book'

// GET /api/books?q=...&tag=...&lang=...&admin=true&page=1
//   q     — полнотекстовый поиск (название/автор/издательство/теги/языки)
//   tag   — фильтр по тегу (книга содержит тег в массиве tags[])
//   lang  — фильтр по коду языка (книга содержит код в массиве languageCodes[])
// Можно комбинировать q + tag + lang одновременно.
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const tag = searchParams.get('tag') || ''
    const lang = searchParams.get('lang') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const isAdmin = searchParams.get('admin') === 'true'
    const limit = isAdmin ? 100 : 8
    const skip = isAdmin ? 0 : (page - 1) * limit

    const andConditions: Record<string, unknown>[] = []

    if (query) {
      andConditions.push({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { author: { $regex: query, $options: 'i' } },
          { publisher_year: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } },
          { languages: { $regex: query, $options: 'i' } },
        ],
      })
    }

    if (tag) {
      andConditions.push({ tags: tag })
    }

    if (lang) {
      andConditions.push({ languageCodes: lang })
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {}

    let books
    if (isAdmin) {
      books = await db.collection('books').aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'borrows',
            let: { bookId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$bookId', '$$bookId'] },
                  status: 'active'
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user'
                }
              },
              { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  userName: 1,
                  userEmail: 1,
                  userTelegram: 1,
                  borrowDate: 1,
                  dueDate: 1,
                  'user.firstName': 1,
                  'user.lastName': 1,
                  'user.email': 1,
                  'user.telegram': 1
                }
              }
            ],
            as: 'activeBorrows'
          }
        },
        {
          $addFields: {
            currentHolder: { $arrayElemAt: ['$activeBorrows', 0] }
          }
        },
        { $sort: { title: 1 } }
      ]).toArray()
    } else {
      books = await db
        .collection<Book>('books')
        .find(filter)
        .sort({ title: 1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    }

    const total = await db.collection<Book>('books').countDocuments(filter)

    if (isAdmin) {
      return NextResponse.json({
        books,
        totalBooks: total
      })
    } else {
      const totalPages = Math.ceil(total / limit)
      return NextResponse.json({
        books,
        pagination: {
          currentPage: page,
          totalPages,
          totalBooks: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      })
    }
  } catch (error) {
    console.error('Books API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const bookData: BookCreate = await request.json()

    const book: Book = {
      ...bookData,
      tags: bookData.tags || [],
      languages: bookData.languages || [],
      languageCodes: bookData.languageCodes || [],
      languageDetails: (bookData.languages || []).map((name, i) => ({
        name,
        code: (bookData.languageCodes || [])[i] ?? null,
        isPrimary: i === 0,
      })),
      isAvailable: true,
      createdAt: new Date()
    }

    const result = await db.collection<Book>('books').insertOne(book)
    return NextResponse.json({ _id: result.insertedId, ...book })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
