import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('library')
    const user = await db.collection('users').findOne({ email })

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // В реальном приложении здесь была бы JWT сессия
    // Для упрощения используем простой подход
    const response = NextResponse.json({ success: true, user })
    
    // Устанавливаем куки для сессии (упрощенный вариант)
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