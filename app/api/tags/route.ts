import { NextResponse } from 'next/server'
import clientPromise from '@/lib/db'
import { Tag } from '@/lib/models/Tag'

// GET /api/tags -> список тегов со статистикой (для выпадающего фильтра),
// отсортированный по популярности — как в arcticlab_lib (bookCount desc)
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('library')

    const tags = await db
      .collection<Tag>('tags')
      .find({})
      .sort({ bookCount: -1, name: 1 })
      .toArray()

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tags API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
