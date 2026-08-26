import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmailNotification({ to, subject, text, html }: EmailOptions) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || text,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Email sent to ${to}`)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export async function sendOverdueNotification(borrow: any) {
  const dueDate = borrow.dueDate instanceof Date ? borrow.dueDate : new Date(borrow.dueDate)
  const book = borrow.book || {}
  
  const subject = 'Просрочка возврата книги'
  const text = `Уважаемый ${borrow.userName},\n\nВы не вернули книгу "${book.title}" вовремя. Пожалуйста, верните книгу как можно скорее.\n\nДата возврата: ${dueDate.toLocaleDateString('ru-RU')}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Просрочка возврата книги</h2>
      <p>Уважаемый ${borrow.userName},</p>
      <p>Вы не вернули книгу <strong>"${book.title}"</strong> вовремя. Пожалуйста, верните книгу как можно скорее.</p>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="margin-top: 0;">Информация о книге:</h3>
        <p><strong>Название:</strong> ${book.title}</p>
        <p><strong>Автор:</strong> ${book.author || 'не указан'}</p>
        <p><strong>Издательство:</strong> ${book.publisher || 'не указано'}</p>
        <p><strong>Год:</strong> ${book.year || 'не указан'}</p>
      </div>
      
      <p><strong>Дата возврата:</strong> ${dueDate.toLocaleDateString('ru-RU')}</p>
      <br>
      <p>С уважением,<br>Библиотека</p>
    </div>
  `

  return sendEmailNotification({
    to: borrow.userEmail,
    subject,
    text,
    html,
  })
}

export async function checkOverdueBooks() {
  try {
    const client = await import('./db').then(mod => mod.default)
    const db = (await client).db('library')
    const today = new Date()

    const overdueBorrows = await db.collection('borrows').aggregate([
      {
        $match: {
          status: 'active',
          dueDate: { $lt: today }
        }
      },
      {
        $lookup: {
          from: 'books',
          localField: 'bookId',
          foreignField: '_id',
          as: 'book'
        }
      },
      {
        $unwind: '$book'
      }
    ]).toArray()

    for (const borrow of overdueBorrows) {
      await sendOverdueNotification(borrow)
      
      // Обновляем статус на просроченный
      await db.collection('borrows').updateOne(
        { _id: borrow._id },
        { $set: { status: 'overdue' } }
      )
    }

    console.log(`Checked overdue books: ${overdueBorrows.length} overdue`)
  } catch (error) {
    console.error('Error checking overdue books:', error)
  }
}