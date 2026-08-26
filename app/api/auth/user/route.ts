import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const email = request.cookies.get('user_email')?.value
    
    if (!email) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db('library')
    const user = await db.collection('users').findOne({ email })

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Получаем информацию о взятых книгах
    const borrowedBooks = await db.collection('books').find({
      _id: { $in: user.borrowedBooks || [] }
    }).toArray()

    return NextResponse.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      telegram: user.telegram,
      currentBorrows: user.currentBorrows,
      borrowedBooks: borrowedBooks,
      isAdmin: user.isAdmin || false
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}