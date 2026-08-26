import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/db'
import { Borrow, BorrowCreate } from '@/lib/models/Borrow'
import { sendEmailNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const borrowData: BorrowCreate = await request.json()

    // Преобразуем строки в Date объекты
    const borrowDate = new Date(borrowData.borrowDate)
    const dueDate = new Date(borrowData.dueDate)

    // Проверяем, не превышает ли пользователь лимит в 3 книги
    const activeBorrows = await db
      .collection<Borrow>('borrows')
      .countDocuments({
        userId: new ObjectId(borrowData.userId),
        status: 'active'
      })

    if (activeBorrows >= 3) {
      return NextResponse.json(
        { error: 'Вы не можете взять больше 3 книг одновременно' },
        { status: 400 }
      )
    }

    // Находим книгу с полной информацией
    const book = await db
      .collection('books')
      .findOne({ _id: new ObjectId(borrowData.bookId) })

    if (!book || !book.isAvailable) {
      return NextResponse.json(
        { error: 'Книга недоступна' },
        { status: 400 }
      )
    }

    const borrow: Borrow = {
      ...borrowData,
      bookId: new ObjectId(borrowData.bookId),
      userId: new ObjectId(borrowData.userId),
      borrowDate: borrowDate,
      dueDate: dueDate,
      status: 'active',
      createdAt: new Date()
    }

    // Создаем запись о выдаче
    const result = await db.collection<Borrow>('borrows').insertOne(borrow)

    // Обновляем статус книги
    await db
      .collection('books')
      .updateOne(
        { _id: new ObjectId(borrowData.bookId) },
        { $set: { isAvailable: false } }
      )

    // Обновляем счетчик книг у пользователя и добавляем книгу в borrowedBooks
    await db
      .collection('users')
      .updateOne(
        { _id: new ObjectId(borrowData.userId) },
        { 
          $inc: { currentBorrows: 1 },
          $push: { borrowedBooks: new ObjectId(borrowData.bookId) } as any // Исправление типизации
        }
      )

    // Отправляем уведомление админу с полной информацией о книге
    await sendEmailNotification({
      to: process.env.ADMIN_EMAIL!,
      subject: 'Новая заявка на книгу',
      text: `Пользователь ${borrowData.userName} взял книгу "${book.title}" (автор: ${book.author || 'не указан'}). Дата возврата: ${dueDate.toLocaleDateString('ru-RU')}`,
      html: `
        <div>
          <h2>Новая заявка на книгу</h2>
          <p><strong>Пользователь:</strong> ${borrowData.userName}</p>
          <p><strong>Email:</strong> ${borrowData.userEmail}</p>
          <p><strong>Телеграм:</strong> ${borrowData.userTelegram || 'не указан'}</p>
          <hr>
          <p><strong>Книга:</strong> "${book.title}"</p>
          <p><strong>Автор:</strong> ${book.author || 'не указан'}</p>
          <p><strong>Издательство и год:</strong> ${book.publisher_year || 'не указано'}</p>
          <p><strong>Дата взятия:</strong> ${borrowDate.toLocaleDateString('ru-RU')}</p>
          <p><strong>Планируемая дата возврата:</strong> ${dueDate.toLocaleDateString('ru-RU')}</p>
        </div>
      `
    })

    // Возвращаем полную информацию о выдаче
    return NextResponse.json({ 
      _id: result.insertedId, 
      ...borrow,
      book: book
    })
  } catch (error) {
    console.error('Borrow error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const searchParams = request.nextUrl.searchParams
    const bookId = searchParams.get('bookId')
    const userId = searchParams.get('userId')

    let filter = {}

    if (bookId && userId) {
      // Ищем активную выдачу для конкретной книги и пользователя
      filter = {
        bookId: new ObjectId(bookId),
        userId: new ObjectId(userId),
        status: 'active'
      }
    } else if (userId) {
      // Ищем все выдачи пользователя
      filter = { userId: new ObjectId(userId) }
    } else if (bookId) {
      // Ищем все выдачи книги
      filter = { bookId: new ObjectId(bookId) }
    }

    const borrows = await db
      .collection('borrows')
      .aggregate([
        {
          $match: filter
        },
        {
          $lookup: {
            from: 'books',
            localField: 'bookId',
            foreignField: '_id',
            as: 'book'
          }
        },
        {
          $unwind: {
            path: '$book',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ])
      .toArray()

    return NextResponse.json(borrows)
  } catch (error) {
    console.error('Get borrows error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}