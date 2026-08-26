import { ObjectId } from 'mongodb'

// Структура книги объединяет две модели:
// - выдача/бронирование книг из biblo (isAvailable, currentHolder)
// - таксономия тегов/языков из arcticlab_lib (tags[], languages[], languageCodes[])
// У книги может быть НЕСКОЛЬКО тегов и НЕСКОЛЬКО языков одновременно.

export interface LanguageDetail {
  name: string
  code: string | null
  isPrimary: boolean
}

export interface CurrentHolder {
  userName: string
  userEmail: string
  userTelegram?: string
  borrowDate: Date
  dueDate: Date
}

export interface Book {
  _id?: ObjectId
  author?: string
  title: string
  publisher_year?: string // издательство, год — единое поле, как в исходных данных
  publicationType?: string // тип: сборник, дисс, материалы экспедиции...
  location?: string // где: шкаф_1, полки(а)_5...

  tags: string[] // тэг (может быть несколько на книгу)

  languages: string[] // человекочитаемые названия языков
  languageCodes: string[] // коды языков, тот же порядок, что и languages
  languageDetails: LanguageDetail[] // { name, code, isPrimary } для каждого языка

  isAvailable: boolean
  createdAt: Date
  isUserBook?: boolean // enrich-поле, проставляется на бэкенде при выдаче списка
  currentHolder?: CurrentHolder
}

export interface BookCreate {
  author?: string
  title: string
  publisher_year?: string
  publicationType?: string
  location?: string
  tags?: string[]
  languages?: string[]
  languageCodes?: string[]
}

// Приводит "языки" + "коды" (как в исходном xlsx: списки через запятую в одном
// порядке) к массивам и к массиву LanguageDetail — логика перенесена из
// books_mongo_arcticlab.ipynb (parse_languages_with_codes).
export function buildLanguageDetails(
  languages: string[],
  languageCodes: string[]
): LanguageDetail[] {
  return languages.map((name, i) => ({
    name,
    code: languageCodes[i] ?? null,
    isPrimary: i === 0,
  }))
}
