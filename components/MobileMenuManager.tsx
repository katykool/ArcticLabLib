'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function MobileMenuManager() {
  const pathname = usePathname()

  useEffect(() => {
    // Закрываем мобильное меню при смене роута
    document.body.classList.remove('menu-open')
  }, [pathname])

  return null // Этот компонент не рендерит ничего, только управляет состоянием
}