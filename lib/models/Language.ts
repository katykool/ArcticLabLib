// Вспомогательная коллекция `languages` — статистика по языкам, встречающимся
// в книгах. Пересобирается скриптом импорта (см. scripts/import-books.mjs),
// как в исходном arcticlab_lib.
export interface Language {
  code: string
  name: string
  bookCount: number
  sampleBooks: string[]
  updatedAt: Date
}
