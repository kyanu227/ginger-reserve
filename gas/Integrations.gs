// ===== ヘルパー関数 =====
function formatTimeValue(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Tokyo', 'HH:mm')
  }
  if (typeof val === 'string' && val.length > 5) {
    try {
      return Utilities.formatDate(new Date(val), 'Asia/Tokyo', 'HH:mm')
    } catch(e) { return val }
  }
  return String(val)
}

// ===== メール通知 =====
function sendCustomerEmail(r, id, menu, totalPrice, status = 'confirmed') {
  const isPending = status === 'pending'
  const subject = isPending
    ? `【${BUSINESS_NAME}】ご予約リクエストを承りました - ${id}`
    : `【${BUSINESS_NAME}】ご予約確認 - ${id}`

  // マッサージチェア情報
  let massageInfo = ''
  if (r.options && r.options.includes('massage-chair')) {
    const d1 = r.massageDuration1 || 20
    const guests = r.guests || 1
    if (guests >= 2) {
      const d2 = r.massageDuration2 || 20
      massageInfo = `\nマッサージチェア: ${d1}分（1人目）+ ${d2}分（2人目）`
    } else {
      massageInfo = `\nマッサージチェア: ${d1}分`
    }
  }

  const introText = isPending
    ? `${BUSINESS_NAME}へのご予約リクエストを承りました。\n現在、予約枠の空き状況を確認中です。\n予約が確定いたしましたら、改めてご連絡させていただきます。`
    : `${BUSINESS_NAME}をご予約いただきありがとうございます。\n以下の内容でご予約を承りました。`

  const body = `
${r.lastName} ${r.firstName} 様

${introText}

━━━━━━━━━━━━━━━━━━━━
予約番号: ${id}
ステータス: ${isPending ? '承認待ち (リクエスト中)' : '予約確定'}
コース: ${menu ? menu.name : r.menuId}
日時: ${r.date} ${r.time}〜
人数: ${r.guests || 1}名${massageInfo}
合計: ¥${totalPrice.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━

キャンセル・変更はお電話またはメールにてご連絡ください。
${!isPending ? '当日お会いできることを楽しみにしております。\n\n' : '\n'}${BUSINESS_NAME}
`

  if (r.email) {
    MailApp.sendEmail(r.email, subject, body)
  }
}

function sendAdminNotification(r, id, menu, totalPrice, status = 'confirmed') {
  const isPending = status === 'pending'
  const subject = isPending
    ? `【要承認・予約リクエスト】${r.lastName}${r.firstName}様 - ${r.date} ${r.time}`
    : `【新規予約】${r.lastName}${r.firstName}様 - ${r.date} ${r.time}`

  let massageInfo = ''
  if (r.options && r.options.includes('massage-chair')) {
    const d1 = r.massageDuration1 || 20
    const guests = r.guests || 1
    if (guests >= 2) {
      const d2 = r.massageDuration2 || 20
      massageInfo = `\nマッサージチェア: ${d1}分 + ${d2}分`
    } else {
      massageInfo = `\nマッサージチェア: ${d1}分`
    }
  }

  const introText = isPending
    ? `新しい予約リクエスト（承認待ち）が入りました。\n管理画面から承認を行うと、お客様に確定メールが送信されカレンダーに登録されます。`
    : `新規予約が確定しました。`

  const body = `
${introText}

予約番号: ${id}
ステータス: ${isPending ? '承認待ち' : '確定'}
お客様: ${r.lastName} ${r.firstName}
電話: ${r.phone}
メール: ${r.email}
コース: ${menu ? menu.name : r.menuId}
日時: ${r.date} ${r.time}〜
人数: ${r.guests || 1}名${massageInfo}
合計: ¥${totalPrice.toLocaleString()}
備考: ${r.notes || 'なし'}
`

  ADMIN_EMAILS.forEach(email => {
    MailApp.sendEmail(email, subject, body)
  })
}

// ===== Googleカレンダー連携 =====
function addToCalendar(r, id, menu, reservation) {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar()
  const baseDuration = menu ? (menu.duration || 30) : 30

  // マッサージチェア利用時は所要時間を加算
  let totalDuration = baseDuration
  if (reservation && reservation.options && reservation.options.includes('massage-chair')) {
    const d1 = reservation.massageDuration1 || 20
    const guests = reservation.guests || 1
    totalDuration += d1
    if (guests >= 2) {
      const d2 = reservation.massageDuration2 || 20
      totalDuration += d2
    }
  }

  const startTime = new Date(`${r.date}T${r.time}:00`)
  const endTime = new Date(startTime.getTime() + totalDuration * 60000)

  let massageNote = ''
  if (reservation && reservation.options && reservation.options.includes('massage-chair')) {
    massageNote = `\nマッサージチェア: あり`
  }

  cal.createEvent(
    `${menu ? menu.icon : '🌿'} ${r.lastName}${r.firstName}様 - ${menu ? menu.name : '予約'}`,
    startTime,
    endTime,
    {
      description: `予約番号: ${id}\n人数: ${r.guests || 1}名${massageNote}\n電話: ${r.phone}\nメール: ${r.email}\n備考: ${r.notes || 'なし'}`,
      location: BUSINESS_NAME
    }
  )
}
