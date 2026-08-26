// Плоское представление дерева языковых семей (собирается из
// scripts/language_tree.json скриптом импорта). Позволяет искать книги не
// только по конкретному языку, но и по всей семье/группе языков через
// $graphLookup — например, все книги на любом уральском языке.
export interface LanguageTreeNode {
  code: string
  name: string
  type: string // 'root' | 'регион' | 'группа' | 'подгруппа' | 'язык' | ...
  parentCode: string | null
  level: number
}
