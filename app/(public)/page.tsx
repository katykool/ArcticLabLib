import { BookCard } from '@/components/BookCard'
import { SearchBar } from '@/components/SearchBar'
import { TagLanguageFilter } from '@/components/TagLanguageFilter'
import { BooksPagination } from '@/components/BooksPagination'
import { Book } from '@/lib/models/Book'
import { cookies } from 'next/headers'

async function getBooks(search?: string, page?: number, tag?: string, lang?: string): Promise<{ 
  books: Book[] 
  pagination: {
    currentPage: number
    totalPages: number
    totalBooks: number
    hasNext: boolean
    hasPrev: boolean
  }
}> {
  const cookieStore = await cookies();
  const url = new URL('/api/books/sorted', process.env.NEXTAUTH_URL || 'http://localhost:3000')
  
  if (search) {
    url.searchParams.set('q', search)
  }
  if (page) {
    url.searchParams.set('page', page.toString())
  }
  if (tag) {
    url.searchParams.set('tag', tag)
  }
  if (lang) {
    url.searchParams.set('lang', lang)
  }

  const response = await fetch(url.toString(), {
    headers: {
      email: cookieStore.get("user_email")?.value ?? "",
    },
    cache: 'no-store'
  })
  
  if (!response.ok) {
    console.error('Failed to fetch books:', response.status)
    return { 
      books: [], 
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalBooks: 0,
        hasNext: false,
        hasPrev: false
      }
    }
  }
  
  return response.json()
}

interface HomePageProps {
  searchParams: Promise<{ q?: string; page?: string; tag?: string; lang?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q, page, tag, lang } = await searchParams
  const currentPage = parseInt(page || '1')
  
  const { books, pagination } = await getBooks(q, currentPage, tag, lang)
  const hasFilters = Boolean(q || tag || lang)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-center mb-4">Библиотека</h1>
        <SearchBar initialValue={q} />
        <TagLanguageFilter initialTag={tag} initialLang={lang} />
        
        {hasFilters && (
          <div className="text-center mt-4">
            <p className="text-muted-foreground">
              {q && (
                <>Результаты поиска по запросу: <span className="font-semibold">"{q}"</span> </>
              )}
              {tag && <>· тег: <span className="font-semibold">{tag}</span> </>}
              {lang && <>· язык: <span className="font-semibold">{lang}</span> </>}
              {books.length > 0 && (
                <span className="ml-2">
                  ({pagination.totalBooks} {pagination.totalBooks === 1 ? 'книга' : 
                   pagination.totalBooks >= 2 && pagination.totalBooks <= 4 ? 'книги' : 'книг'})
                </span>
              )}
            </p>
          </div>
        )}
      </div>
      
      {books.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <BookCard
                key={book._id!.toString()}
                book={book}
              />
            ))}
          </div>

          <BooksPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalBooks={pagination.totalBooks}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
          />
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">
            {hasFilters ? 'Книги по вашему запросу не найдены' : 'В библиотеке пока нет книг'}
          </p>
          {!hasFilters && (
            <p className="text-sm text-muted-foreground mt-2">
              Добавьте книги через админ-панель
            </p>
          )}
        </div>
      )}
    </div>
  )
}