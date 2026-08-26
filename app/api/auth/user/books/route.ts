import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('user_email')?.value

    if (!userEmail) {
      return NextResponse.json({ borrowedBooks: [] })
    }

    const client = await clientPromise
    const db = client.db('library')
    
    const user = await db.collection('users').findOne({ email: userEmail })
    
    if (!user || !user.borrowedBooks || user.borrowedBooks.length === 0) {
      return NextResponse.json({ borrowedBooks: [] })
    }

    // Получаем полную информацию о взятых книгах
    const borrowedBooks = await db.collection('books').find({
      _id: { $in: user.borrowedBooks }
    }).toArray()

    return NextResponse.json({ 
      borrowedBooks: borrowedBooks.map(book => book._id.toString())
    })
  } catch (error) {
    console.error('User books API error:', error)
    return NextResponse.json({ borrowedBooks: [] })
  }
}