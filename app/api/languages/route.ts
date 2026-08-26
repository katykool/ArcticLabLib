import { NextResponse } from 'next/server'
import clientPromise from '@/lib/db'
import { Language } from '@/lib/models/Language'

// GET /api/languages -> список языков со статистикой (для выпадающего
// фильтра), отсортированный по популярности — как в arcticlab_lib
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('library')

    const languages = await db
      .collection<Language>('languages')
      .find({})
      .sort({ bookCount: -1, name: 1 })
      .toArray()

    return NextResponse.json({ languages })
  } catch (error) {
    console.error('Languages API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
