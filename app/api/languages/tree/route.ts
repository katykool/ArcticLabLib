import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/db'
import { LanguageTreeNode } from '@/lib/models/LanguageTreeNode'

// GET /api/languages/tree
//   -> весь список узлов дерева (для построения UI-дерева / выпадающего списка)
// GET /api/languages/tree?code=ural
//   -> книги на языке `ural` И на всех его потомках (группах/подгруппах/языках),
//      логика 1:1 перенесена из books_mongo_arcticlab.ipynb ($graphLookup)
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const code = request.nextUrl.searchParams.get('code')

    if (!code) {
      const nodes = await db
        .collection<LanguageTreeNode>('language_tree')
        .find({})
        .sort({ level: 1, name: 1 })
        .toArray()
      return NextResponse.json({ nodes })
    }

    const pipeline = [
      { $match: { code } },
      {
        $graphLookup: {
          from: 'language_tree',
          startWith: '$code',
          connectFromField: 'code',
          connectToField: 'parentCode',
          as: 'descendants',
          depthField: 'depth',
        },
      },
      {
        $addFields: {
          allCodes: {
            $concatArrays: [['$code'], '$descendants.code'],
          },
        },
      },
    ]

    const result = await db
      .collection('language_tree')
      .aggregate(pipeline)
      .toArray()

    if (!result.length) {
      return NextResponse.json({ error: 'Узел языка не найден' }, { status: 404 })
    }

    const node = result[0]
    const allCodes: string[] = node.allCodes

    const books = await db
      .collection('books')
      .find({ languageCodes: { $in: allCodes } })
      .sort({ title: 1 })
      .toArray()

    return NextResponse.json({
      node: { code: node.code, name: node.name, type: node.type },
      allCodes,
      books,
      totalBooks: books.length,
    })
  } catch (error) {
    console.error('Language tree API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
