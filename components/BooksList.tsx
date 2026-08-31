'use client'

import { Book } from '@/lib/models/Book'
import { BookCard } from './BookCard'
import { useEffect, useState } from 'react'

interface BooksListProps {
  books: Book[]
}

interface BorrowInfo {
  _id: string
  bookId: string
  userId: string
  dueDate: string
  borrowDate?: string
  status: 'active' | 'overdue' | 'returned'
}

export function BooksList({ books }: BooksListProps) {
  const [userBorrowedBooks, setUserBorrowedBooks] = useState<string[]>([])
  const [borrowDueDates, setBorrowDueDates] = useState<Record<string, string>>({})
  const [sortedBooks, setSortedBooks] = useState<Book[]>([])

  useEffect(() => {
    const fetchUserBooks = async () => {
      try {
        // Получаем текущего пользователя.
        // Этот endpoint уже существует в проекте.
        const userResponse = await fetch('/api/auth/user')

        if (!userResponse.ok) {
          setUserBorrowedBooks([])
          setBorrowDueDates({})
          return
        }

        const user = await userResponse.json()

        // /api/auth/user возвращает borrowedBooks как массив
        // полных объектов книг.
        const borrowedBooks: Book[] = user.borrowedBooks || []

        const borrowedIds = borrowedBooks
          .map((book) => book._id?.toString())
          .filter(Boolean) as string[]

        setUserBorrowedBooks(borrowedIds)

        // Получаем выдачи именно этого пользователя,
        // чтобы узнать dueDate каждой книги.
        if (user._id) {
          const borrowsResponse = await fetch(
            `/api/borrow?userId=${user._id}`
          )

          if (borrowsResponse.ok) {
            const borrows: BorrowInfo[] =
              await borrowsResponse.json()

            const dueDates: Record<string, string> = {}

            borrows.forEach((borrow) => {
              // Нам нужны только текущие выдачи.
              if (
                (borrow.status === 'active' ||
                  borrow.status === 'overdue') &&
                borrow.bookId &&
                borrow.dueDate
              ) {
                dueDates[borrow.bookId.toString()] =
                  borrow.dueDate
              }
            })

            setBorrowDueDates(dueDates)
          }
        }
      } catch (error) {
        console.error(
          'Error fetching user books:',
          error
        )
      }
    }

    fetchUserBooks()
  }, [])

  useEffect(() => {
    // Сортируем книги:
    // сначала книги, которые взял текущий пользователь,
    // потом остальные.
    const sorted = [...books].sort((a, b) => {
      const aIsBorrowed = userBorrowedBooks.includes(
        a._id!.toString()
      )

      const bIsBorrowed = userBorrowedBooks.includes(
        b._id!.toString()
      )

      if (aIsBorrowed && !bIsBorrowed) return -1
      if (!aIsBorrowed && bIsBorrowed) return 1

      return 0
    })

    setSortedBooks(sorted)
  }, [books, userBorrowedBooks])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {sortedBooks.map((book) => {
        const bookId = book._id!.toString()

        return (
          <BookCard
            key={bookId}
            book={book}
            dueDate={borrowDueDates[bookId]}
          />
        )
      })}
    </div>
  )
}