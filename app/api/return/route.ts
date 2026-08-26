import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/db'
import { sendEmailNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { borrowId } = await request.json()
    
    if (!borrowId) {
      return NextResponse.json({ error: 'Borrow ID is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('library')

    // Находим запись о выдаче вместе с информацией о книге
    const borrow = await db.collection('borrows').aggregate([
      {
        $match: { _id: new ObjectId(borrowId) }
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
        $unwind: '$book'
      }
    ]).next()

    if (!borrow) {
      return NextResponse.json({ error: 'Borrow record not found' }, { status: 404 })
    }

    // Обновляем запись о выдаче
    await db.collection('borrows').updateOne(
      { _id: new ObjectId(borrowId) },
      { 
        $set: { 
          returnDate: new Date(),
          status: 'returned'
        } 
      }
    )

    // Обновляем статус книги
    await db.collection('books').updateOne(
      { _id: new ObjectId(borrow.bookId) },
      { $set: { isAvailable: true } }
    )

    // Обновляем счетчик книг у пользователя и убираем книгу из borrowedBooks
    await db.collection('users').updateOne(
      { _id: new ObjectId(borrow.userId) },
      { 
        $inc: { currentBorrows: -1 },
        $pull: { borrowedBooks: borrow.bookId } as any // Исправление типизации
      }
    )

    // Отправляем уведомление админу с полной информацией о книге
    await sendEmailNotification({
      to: process.env.ADMIN_EMAIL!,
      subject: 'Книга возвращена',
      text: `Пользователь ${borrow.userName} вернул книгу "${borrow.book.title}" (автор: ${borrow.book.author || 'не указан'}).`,
      html: `
        <div>
          <h2>Книга возвращена</h2>
          <p><strong>Пользователь:</strong> ${borrow.userName}</p>
          <p><strong>Email:</strong> ${borrow.userEmail}</p>
          <p><strong>Телеграм:</strong> ${borrow.userTelegram || 'не указан'}</p>
          <hr>
          <p><strong>Книга:</strong> "${borrow.book.title}"</p>
          <p><strong>Автор:</strong> ${borrow.book.author || 'не указан'}</p>
          <p><strong>Издательство и год:</strong> ${borrow.book.publisher_year || 'не указано'}</p>
          <p><strong>Дата возврата:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
        </div>
      `
    })

    // Возвращаем полную информацию о возврате
    return NextResponse.json({ 
      success: true,
      borrow: {
        ...borrow,
        book: borrow.book
      }
    })
  } catch (error) {
    console.error('Return error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}