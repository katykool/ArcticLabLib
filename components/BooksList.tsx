'use client'

import { Book } from '@/lib/models/Book'
import { BookCard } from './BookCard'
import { useEffect, useState } from 'react'

interface BooksListProps {
  books: Book[]
}

export function BooksList({ books }: BooksListProps) {
  const [userBorrowedBooks, setUserBorrowedBooks] = useState<string[]>([])
  const [sortedBooks, setSortedBooks] = useState<Book[]>([])

  useEffect(() => {
    // Загружаем ID взятых книг пользователя
    const fetchUserBooks = async () => {
      try {
        const response = await fetch('/api/user/books')
        if (response.ok) {
          const data = await response.json()
          setUserBorrowedBooks(data.borrowedBooks || [])
        }
      } catch (error) {
        console.error('Error fetching user books:', error)
      }
    }

    fetchUserBooks()
  }, [])

  useEffect(() => {
    // Сортируем книги: сначала взятые пользователем, потом остальные
    const sorted = [...books].sort((a, b) => {
      const aIsBorrowed = userBorrowedBooks.includes(a._id!.toString())
      const bIsBorrowed = userBorrowedBooks.includes(b._id!.toString())
      
      if (aIsBorrowed && !bIsBorrowed) return -1
      if (!aIsBorrowed && bIsBorrowed) return 1
      return 0
    })
    
    setSortedBooks(sorted)
  }, [books, userBorrowedBooks])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {sortedBooks.map((book) => (
        <BookCard
          key={book._id!.toString()}
          book={book}
        />
      ))}
    </div>
  )
}