import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/db'
import { Book } from '@/lib/models/Book'
import { upsertBookRow, clearBookRow } from '@/lib/googleSheets'

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

    const objectId = new ObjectId(id)

    // Обновляем книгу в MongoDB
    const result = await db
      .collection<Book>('books')
      .updateOne(
        { _id: objectId },
        { $set: updateData }
      )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    // Получаем уже обновлённую книгу целиком
    const updatedBook = await db
      .collection<Book>('books')
      .findOne({ _id: objectId })

    // Синхронизируем обновлённую книгу с Google Sheets
    if (updatedBook) {
      console.log('SYNC TO SHEETS: starting', updatedBook._id.toString())

      try {
        await upsertBookRow(updatedBook)
        console.log('SYNC TO SHEETS: success', updatedBook._id.toString())
      } catch (error) {
        console.error('SYNC TO SHEETS: FAILED', error)
      }
}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update book error:', error)

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
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

    const objectId = new ObjectId(id)

    // Удаляем книгу из MongoDB
    const result = await db
      .collection<Book>('books')
      .deleteOne({ _id: objectId })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    // Очищаем соответствующую строку в Google Sheets
    await clearBookRow(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete book error:', error)

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}