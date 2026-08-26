'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface BooksPaginationProps {
  currentPage: number
  totalPages: number
  totalBooks: number
  hasNext: boolean
  hasPrev: boolean
}

export function BooksPagination({
  currentPage,
  totalPages,
  totalBooks,
  hasNext,
  hasPrev
}: BooksPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const createPageURL = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', pageNumber.toString())
    return `/?${params.toString()}`
  }

  const handlePageChange = (page: number) => {
    router.push(createPageURL(page))
  }

  // Генерируем массив страниц для отображения
  const getVisiblePages = () => {
    const pages = []
    const delta = 2 // Количество страниц слева и справа от текущей
    
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      pages.push(i)
    }

    // Добавляем первую страницу если нужно
    if (currentPage - delta > 2) {
      pages.unshift(1, '...')
    } else if (currentPage - delta === 2) {
      pages.unshift(1)
    }

    // Добавляем последнюю страницу если нужно
    if (currentPage + delta < totalPages - 1) {
      pages.push('...', totalPages)
    } else if (currentPage + delta === totalPages - 1) {
      pages.push(totalPages)
    }

    // Всегда показываем первую и последнюю страницу
    if (!pages.includes(1)) pages.unshift(1)
    if (!pages.includes(totalPages) && totalPages > 1) pages.push(totalPages)

    return pages
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <p className="text-sm text-muted-foreground">
        Показано {(currentPage - 1) * 12 + 1}-{Math.min(currentPage * 12, totalBooks)} из {totalBooks} книг
      </p>
      
      <Pagination>
        <PaginationContent>
          {/* Кнопка "Назад" */}
          <PaginationItem>
            <PaginationPrevious
              href={createPageURL(currentPage - 1)}
              onClick={(e) => {
                e.preventDefault()
                if (hasPrev) handlePageChange(currentPage - 1)
              }}
              className={!hasPrev ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>

          {/* Номера страниц */}
          {getVisiblePages().map((page, index) => (
            <PaginationItem key={index}>
              {page === '...' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={createPageURL(page as number)}
                  onClick={(e) => {
                    e.preventDefault()
                    handlePageChange(page as number)
                  }}
                  isActive={currentPage === page}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          {/* Кнопка "Вперед" */}
          <PaginationItem>
            <PaginationNext
              href={createPageURL(currentPage + 1)}
              onClick={(e) => {
                e.preventDefault()
                if (hasNext) handlePageChange(currentPage + 1)
              }}
              className={!hasNext ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}