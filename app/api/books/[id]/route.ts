import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/db'
import { Book } from '@/lib/models/Book'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = await clientPromise
    const db = client.db('library')
    const bookData = await request.json()

    // Убираем поля, которые нельзя обновлять
    const { _id, createdAt, isAvailable, ...updateData } = bookData

    const result = await db
      .collection<Book>('books')
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update book error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const client = await clientPromise
    const db = client.db('library')

    const result = await db
      .collection<Book>('books')
      .deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete book error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}