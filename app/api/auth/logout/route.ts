import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out successfully'
    })
    
    // Удаляем куку
    response.cookies.set({
      name: 'user_email',
      value: '',
      expires: new Date(0),
      path: '/',
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Также можно добавить GET для редиректа
export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL))
  
  response.cookies.set({
    name: 'user_email',
    value: '',
    expires: new Date(0),
    path: '/',
  })

  return response
}