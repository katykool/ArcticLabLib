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

  await sendEmailNotification({
    to: borrow.userEmail,
    subject,
    text,
    html,
  })

  // Отдельно уведомляем администратора — письмо читателю выше не даёт
  // об этом знать администратору, а библиотеке нужно отслеживать
  // просроченные книги централизованно.
  if (process.env.ADMIN_EMAIL) {
    const adminSubject = `Книга просрочена: "${book.title}"`
    const adminText = `Читатель ${borrow.userName} (${borrow.userEmail}) не вернул книгу "${book.title}" вовремя. Срок возврата был: ${dueDate.toLocaleDateString('ru-RU')}.`

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Книга просрочена</h2>
        <p><strong>Читатель:</strong> ${borrow.userName}</p>
        <p><strong>Email:</strong> ${borrow.userEmail}</p>
        <p><strong>Telegram:</strong> ${borrow.userTelegram || 'не указан'}</p>
        <hr>
        <p><strong>Книга:</strong> "${book.title}"</p>
        <p><strong>Автор:</strong> ${book.author || 'не указан'}</p>
        <p><strong>Издательство и год:</strong> ${book.publisher_year || 'не указано'}</p>
        <p><strong>Срок возврата был:</strong> ${dueDate.toLocaleDateString('ru-RU')}</p>
        <p>Читателю уже отправлено напоминание, новые книги ему выдать нельзя, пока он не вернёт эту.</p>
      </div>
    `

    try {
      await sendEmailNotification({
        to: process.env.ADMIN_EMAIL,
        subject: adminSubject,
        text: adminText,
        html: adminHtml,
      })
    } catch (error) {
      // Не даём сбою письма администратору сорвать основной процесс —
      // читатель уже уведомлён, это лишь дополнительное оповещение.
      console.error('Failed to send admin overdue notification:', error)
    }
  }
}

export async function checkOverdueBooks() {
  const client = await import('./db').then(mod => mod.default)
  const db = (await client).db('library')
  const today = new Date()

  // Свежепросроченные (ещё 'active', срок уже прошёл) — по ним шлём
  // письмо и переводим в 'overdue'. Записи, уже помеченные 'overdue',
  // сюда не попадают повторно, поэтому письмо уходит один раз.
  const newlyOverdueBorrows = await db.collection('borrows').aggregate([
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

  let notified = 0
  let failed = 0

  for (const borrow of newlyOverdueBorrows) {
    try {
      await sendOverdueNotification(borrow)
      notified++
    } catch (error) {
      // Не даём одному упавшему письму остановить обработку остальных
      console.error(`Failed to send overdue notification for borrow ${borrow._id}:`, error)
      failed++
    }

    // Статус переводим в любом случае — иначе при следующем запуске
    // мы бесконечно будем пытаться слать письмо по одной и той же записи
    await db.collection('borrows').updateOne(
      { _id: borrow._id },
      { $set: { status: 'overdue' } }
    )
  }

  const summary = {
    checkedAt: today.toISOString(),
    newlyOverdue: newlyOverdueBorrows.length,
    notified,
    failed
  }

  console.log(`Checked overdue books:`, summary)
  return summary
}