'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        toast.success('Вход выполнен успешно!', {
          description: 'Добро пожаловать в библиотеку'
        })
        setTimeout(() => window.location.href = '/', 1000)
      } else {
        const error = await response.json()
        toast.error('Ошибка входа', {
          description: error.error || 'Пользователь не найден. Пожалуйста, зарегистрируйтесь.'
        })
      }
    } catch (error) {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу. Попробуйте еще раз.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Вход в библиотеку</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className='mb-2'>Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Введите ваш email"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти'
              )}
            </Button>
            <div className="text-center">
              <a href="/auth/register" className="text-sm text-blue-600 hover:underline">
                Нет аккаунта? Зарегистрируйтесь
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}