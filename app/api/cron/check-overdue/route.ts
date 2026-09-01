import { NextRequest, NextResponse } from 'next/server'
import { checkOverdueBooks } from '@/lib/email'

// Этот эндпоинт вызывается по расписанию (Dokploy Schedule).
// Он ищет все выдачи со статусом 'active', у которых dueDate уже прошёл,
// шлёт читателю (и администратору) письмо-напоминание и переводит статус в 'overdue'.
//
// Защищён секретом CRON_SECRET, чтобы эндпоинт нельзя было дёргать извне.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkOverdueBooks()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Cron check-overdue error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}