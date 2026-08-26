// Вспомогательная коллекция `tags` — статистика по темам/тегам книг.
export interface Tag {
  name: string
  bookCount: number
  sampleBooks: string[]
  uniqueLanguages: string[]
  updatedAt: Date
}
