import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import clientPromise from '@/lib/db'
import AdminContent from '@/components/AdminContent'

async function checkAdminAccess() {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('user_email')?.value

    console.log('Admin access check for email:', userEmail) // Для дебага

    if (!userEmail) {
      console.log('No user email found, redirecting to login')
      redirect('/auth/login')
    }

    const client = await clientPromise
    const db = client.db('library')
    const user = await db.collection('users').findOne({ email: userEmail })

    console.log('User found:', user?.email, 'isAdmin:', user?.isAdmin) // Для дебага

    if (!user) {
      console.log('User not found in database')
      redirect('/auth/login')
    }

    if (!user.isAdmin) {
      console.log('User is not admin')
      redirect('/')
    }

    return {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      telegram: user.telegram,
      currentBorrows: user.currentBorrows,
      isAdmin: user.isAdmin
    }
  } catch (error) {
    console.error('Admin access check error:', error)
    redirect('/auth/login')
  }
}

export default async function AdminPage() {
  const user = await checkAdminAccess()
  
  return <AdminContent user={user} />
}