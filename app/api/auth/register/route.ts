import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, telegram } = await request.json()
    
    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name and last name are required' }, 
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('library')

    // Проверяем, нет ли уже пользователя с таким email
    const existingUser = await db.collection('users').findOne({ email })
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    // Проверяем, является ли пользователь админом
    const isAdmin = email === process.env.ADMIN_EMAIL

    const user = {
      email,
      firstName,
      lastName,
      telegram: telegram || undefined,
      currentBorrows: 0,
      borrowedBooks: [], // Инициализируем пустой массив
      isAdmin,
      createdAt: new Date()
    }

    const result = await db.collection('users').insertOne(user)

    const response = NextResponse.json({ 
      success: true, 
      user: { 
        _id: result.insertedId, 
        ...user 
      } 
    })
    
    // Устанавливаем куки для сессии
    response.cookies.set('user_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 1 неделя
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}