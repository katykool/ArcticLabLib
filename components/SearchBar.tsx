'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchBarProps {
  initialValue?: string
}

export function SearchBar({ initialValue = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Используем debounce для задержки запросов
  const debouncedQuery = useDebounce(query, 500)

  const updateURL = useCallback((searchQuery: string) => {
    const params = new URLSearchParams(searchParams)
    
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
      params.delete('page') // Сбрасываем на первую страницу при новом поиске
    } else {
      params.delete('q')
      params.delete('page')
    }
    
    router.push(`/?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Реактивный поиск при изменении debouncedQuery
  useEffect(() => {
    if (debouncedQuery !== initialValue) {
      setIsLoading(true)
      updateURL(debouncedQuery)
      // Сбрасываем loading через небольшой таймаут для лучшего UX
      const timer = setTimeout(() => setIsLoading(false), 300)
      return () => clearTimeout(timer)
    }
  }, [debouncedQuery, initialValue, updateURL])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  const clearSearch = () => {
    setQuery('')
    setIsLoading(true)
    const params = new URLSearchParams(searchParams)
    params.delete('q')
    params.delete('page')
    router.push(`/?${params.toString()}`, { scroll: false })
    // Сбрасываем loading через небольшой таймаут
    setTimeout(() => setIsLoading(false), 300)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Принудительно обновляем URL если пользователь нажал Enter
    if (query !== initialValue) {
      setIsLoading(true)
      updateURL(query)
      setTimeout(() => setIsLoading(false), 300)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Поиск по названию, автору, издательству, тегу или языку..."
          value={query}
          onChange={handleChange}
          className="pl-10 pr-20"
        />
        
        {/* Индикатор загрузки */}
        {isLoading && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {/* Кнопка очистки */}
        {query && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </form>
  )
}