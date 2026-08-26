import { ObjectId } from 'mongodb'

export interface User {
  _id?: ObjectId
  email: string
  firstName: string
  lastName: string
  telegram?: string
  createdAt: Date
  currentBorrows: number
  borrowedBooks: ObjectId[] // Добавляем массив ID взятых книг
  isAdmin?: boolean // Флаг админа
}