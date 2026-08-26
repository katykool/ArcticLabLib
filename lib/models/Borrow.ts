import { ObjectId } from 'mongodb'

export interface Borrow {
  _id?: ObjectId
  bookId: ObjectId
  userId: ObjectId
  userName: string
  userEmail: string
  userTelegram?: string
  borrowDate: Date
  dueDate: Date
  returnDate?: Date
  status: 'active' | 'returned' | 'overdue'
  createdAt: Date
}

export interface BorrowCreate {
  bookId: string
  userId: string
  userName: string
  userEmail: string
  userTelegram?: string
  borrowDate: string // Теперь string, так как передаем ISO строку
  dueDate: string // Теперь string, так как передаем ISO строку
}