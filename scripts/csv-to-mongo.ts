import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'
import clientPromise from '../lib/db'
import { Book, LanguageDetail, buildLanguageDetails } from '../lib/models/Book'

// Импорт книг из CSV + пересборка вспомогательных коллекций (languages, tags,
// language_tree). Логика 1:1 перенесена из books_mongo_arcticlab.ipynb
// (CSVBook, parse_languages_with_codes, transform_books, create_collections),
// адаптирована под структуру Book из biblo (isAvailable/currentHolder и т.д.)

interface CSVRow {
  автор?: string
  название: string
  'издательство, год'?: string
  тэг?: string
  тип?: string
  где?: string
  язык?: string
  код?: string
}

interface LanguageTreeJsonNode {
  code: string
  name: string
  type: string
  children?: LanguageTreeJsonNode[]
}

interface FlatLanguageTreeNode {
  code: string
  name: string
  type: string
  parentCode: string | null
  level: number
}

// --- Парсинг CSV-строк "язык1, язык2" + "код1, код2" в упорядоченные массивы ---
function parseLanguages(languageStr: string, languageCodeStr: string) {
  const langNames = languageStr
    ? languageStr
        .trim()
        .replace(/^["']|["']$/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const codeList = languageCodeStr
    ? languageCodeStr
        .trim()
        .replace(/^["']|["']$/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  langNames.forEach((name, i) => {
    if (!codeList[i]) {
      console.warn(`  код для языка "${name}" не найден`)
    }
  })

  const languageCodes = langNames
    .map((_, i) => codeList[i])
    .filter((c): c is string => Boolean(c))

  const languageDetails: LanguageDetail[] = buildLanguageDetails(
    langNames,
    langNames.map((_, i) => codeList[i] ?? (null as unknown as string))
  )

  return { languages: langNames, languageCodes, languageDetails }
}

function transformRow(row: CSVRow): Omit<Book, '_id'> {
  const tagsStr = row['тэг'] || ''
  const { languages, languageCodes, languageDetails } = parseLanguages(
    row['язык'] || '',
    row['код'] || ''
  )

  return {
    author: row['автор'] || undefined,
    title: row['название'],
    publisher_year: row['издательство, год'] || undefined,
    publicationType: row['тип'] || undefined,
    location: row['где'] || undefined,

    tags: tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),

    languages,
    languageCodes,
    languageDetails,

    isAvailable: true,
    createdAt: new Date(),
  }
}

// --- Дерево языков: json -> плоский список для коллекции language_tree ---
function flattenTree(
  node: LanguageTreeJsonNode,
  parentCode: string | null = null,
  level = 0
): FlatLanguageTreeNode[] {
  const flat: FlatLanguageTreeNode[] = [
    { code: node.code, name: node.name, type: node.type, parentCode, level },
  ]
  if (node.children) {
    for (const child of node.children) {
      flat.push(...flattenTree(child, node.code, level + 1))
    }
  }
  return flat
}

async function importCSV() {
  try {
    const client = await clientPromise
    const db = client.db('library')
    const booksCollection = db.collection<Book>('books')

    // --- 1. Книги ---
    const csvData = readFileSync(join(__dirname, 'books.csv'), 'utf-8')
    const records: CSVRow[] = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })

    const books = records.filter((r) => r['название']).map(transformRow)

    await booksCollection.deleteMany({})
    if (books.length > 0) {
      const result = await booksCollection.insertMany(books as Book[])
      console.log(`Импортировано книг: ${result.insertedCount}`)
    } else {
      console.log('Нет данных для импорта')
    }

    // индексы для books
    await booksCollection.createIndex({ title: 1 })
    await booksCollection.createIndex({ author: 1 })
    await booksCollection.createIndex({ languageCodes: 1 })
    await booksCollection.createIndex({ tags: 1 })
    await booksCollection.createIndex(
      { title: 'text', author: 'text', languages: 'text', tags: 'text', publicationType: 'text' },
      { name: 'text_search_index' }
    )

    // --- 2. Коллекция languages (статистика по языкам) ---
    const languagesCollection = db.collection('languages')
    const languageMap = new Map<
      string,
      { name: string; bookCount: number; sampleBooks: string[] }
    >()

    const allBooks = await booksCollection
      .find({}, { projection: { languageCodes: 1, languages: 1, title: 1 } })
      .toArray()

    for (const book of allBooks) {
      const codes = book.languageCodes || []
      const names = book.languages || []
      codes.forEach((code, i) => {
        const name = names[i]
        if (!code || !name) return
        if (!languageMap.has(code)) {
          languageMap.set(code, { name, bookCount: 0, sampleBooks: [] })
        }
        const entry = languageMap.get(code)!
        entry.bookCount += 1
        entry.sampleBooks.push(book.title)
      })
    }

    await languagesCollection.deleteMany({})
    for (const [code, data] of languageMap) {
      await languagesCollection.updateOne(
        { code },
        {
          $set: {
            code,
            name: data.name,
            bookCount: data.bookCount,
            sampleBooks: data.sampleBooks.slice(0, 5),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      )
    }
    await languagesCollection.createIndex({ code: 1 }, { unique: true, name: 'code_unique_idx' })
    console.log(`Языков собрано: ${languageMap.size}`)

    // --- 3. Коллекция tags (статистика по тегам/темам) ---
    const tagsCollection = db.collection('tags')
    const tagMap = new Map<
      string,
      { bookCount: number; sampleBooks: string[]; languages: Set<string> }
    >()

    const allBooksWithTags = await booksCollection
      .find({}, { projection: { tags: 1, title: 1, languageCodes: 1 } })
      .toArray()

    for (const book of allBooksWithTags) {
      for (const tag of book.tags || []) {
        if (!tag) continue
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { bookCount: 0, sampleBooks: [], languages: new Set() })
        }
        const entry = tagMap.get(tag)!
        entry.bookCount += 1
        entry.sampleBooks.push(book.title)
        for (const code of book.languageCodes || []) entry.languages.add(code)
      }
    }

    await tagsCollection.deleteMany({})
    for (const [name, data] of tagMap) {
      await tagsCollection.updateOne(
        { name },
        {
          $set: {
            name,
            bookCount: data.bookCount,
            sampleBooks: data.sampleBooks.slice(0, 3),
            uniqueLanguages: Array.from(data.languages),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      )
    }
    await tagsCollection.createIndex({ name: 1 }, { unique: true, name: 'tag_name_idx' })
    await tagsCollection.createIndex({ bookCount: -1 }, { name: 'tag_count_idx' })
    console.log(`Тегов собрано: ${tagMap.size}`)

    // --- 4. Коллекция language_tree (иерархия языковых семей) ---
    const treeCollection = db.collection('language_tree')
    const treeJson: LanguageTreeJsonNode = JSON.parse(
      readFileSync(join(__dirname, 'language_tree.json'), 'utf-8')
    )
    const flatTree = flattenTree(treeJson)

    await treeCollection.deleteMany({})
    if (flatTree.length > 0) {
      await treeCollection.insertMany(flatTree)
    }
    await treeCollection.createIndex({ code: 1 }, { unique: true })
    await treeCollection.createIndex({ parentCode: 1 })
    await treeCollection.createIndex({ type: 1 })
    console.log(`Узлов дерева языков: ${flatTree.length}`)

    console.log('\nГотово. Импорт завершён успешно.')
    process.exit(0)
  } catch (error) {
    console.error('Ошибка импорта:', error)
    process.exit(1)
  }
}

importCSV()
