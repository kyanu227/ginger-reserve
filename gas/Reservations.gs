// ===== 予約管理 =====
function getReservations(status, date) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  if (!sheet) return { reservations: [] }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { reservations: [] }

  let reservations = data.slice(1).filter(row => row[0]).map(row => ({
    id: row[0],
    lastName: row[1],
    firstName: row[2],
    phone: row[3],
    email: row[4],
    menuId: row[5],
    date: Utilities.formatDate(new Date(row[6]), 'Asia/Tokyo', 'yyyy-MM-dd'),
    time: formatTimeValue(row[7]),
    guests: row[8],
    options: row[9] ? JSON.parse(row[9]) : [],
    notes: row[10],
    status: row[11],
    totalPrice: row[12],
    createdAt: row[13],
    updatedAt: row[14],
    massageDuration1: row[15] || 0,
    massageDuration2: row[16] || 0
  }))

  if (status && status !== 'all') {
    reservations = reservations.filter(r => r.status === status)
  }
  if (date) {
    reservations = reservations.filter(r => r.date === date)
  }

  return { reservations }
}

function checkRepeaterEmail(email) {
  if (!email) return { isRepeater: false }
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  if (!sheet) return { isRepeater: false }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { isRepeater: false }

  // Check if any row matches the email and is not cancelled
  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][4]
    const status = data[i][11]
    if (rowEmail === email && status !== 'cancelled') {
        return { isRepeater: true }
    }
  }
  return { isRepeater: false }
}

function createReservation(r) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  const id = 'RES-' + new Date().getTime().toString(36).toUpperCase()
  const now = new Date().toISOString()

  // Calculate total price
  const menus = getMenus().menus
  const options = getOptions().options
  const menu = menus.find(m => m.id === r.menuId)
  let totalPrice = menu ? menu.price * (r.guests || 1) : 0
  if (r.options && r.options.length > 0) {
    r.options.forEach(optId => {
      const opt = options.find(o => o.id === optId)
      if (opt) totalPrice += opt.price * (r.guests || 1)
    })
  }

  // Check slot status to determine if confirmed or pending
  const overridesMap = getSlotOverridesMap()
  const key = r.date + '_' + r.time
  const override = overridesMap[key]
  // Default to closed if no override is found (prevent booking), but we'll assume the frontend validated it.
  // We'll trust the override if it exists.
  let slotStatus = 'closed'
  if (override && override.status !== undefined && override.status !== '') {
    slotStatus = override.status
    if (slotStatus === true || slotStatus === 'TRUE') slotStatus = 'open'
    if (slotStatus === false || slotStatus === 'FALSE') slotStatus = 'closed'
  }

  // If slot is request triangle, set to pending. If open circle, set to confirmed. If closed... well, reject?
  // Let's just default to pending if anything is weird.
  const initialReservationStatus = slotStatus === 'open' ? 'confirmed' : 'pending'

  sheet.appendRow([
    id,
    r.lastName,
    r.firstName,
    r.phone,
    r.email,
    r.menuId,
    r.date,
    r.time,
    r.guests || 1,
    JSON.stringify(r.options || []),
    r.notes || '',
    initialReservationStatus,
    totalPrice,
    now,
    now,
    r.massageDuration1 || 0,
    r.massageDuration2 || 0
  ])

  // Update slot booked count (only if confirmed? No, we count pending as booked to prevent double-booking)
  updateSlotBookedCount(r.date, r.time, r.guests || 1)

  // Update massage chair status if applicable
  if (r.options && r.options.includes('massage-chair')) {
    updateSlotMassageChair(r.date, r.time, true)
  }

  // Send notifications
  try {
    sendCustomerEmail(r, id, menu, totalPrice, initialReservationStatus)
    sendAdminNotification(r, id, menu, totalPrice, initialReservationStatus)
  } catch (err) {
    Logger.log('Email error: ' + err.message)
  }

  // Add to Google Calendar (Only if confirmed)
  if (initialReservationStatus === 'confirmed') {
    try {
      addToCalendar(r, id, menu, r)
    } catch (err) {
      Logger.log('Calendar error: ' + err.message)
    }
  }

  return { success: true, id: id, totalPrice: totalPrice, status: initialReservationStatus }
}

function updateReservation(id, updates) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  const data = sheet.getDataRange().getValues()

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      if (updates.options !== undefined) {
        sheet.getRange(i + 1, 10).setValue(JSON.stringify(updates.options))
      }
      if (updates.status !== undefined) {
        const oldStatus = data[i][11]
        sheet.getRange(i + 1, 12).setValue(updates.status)

        // If transitioning from pending to confirmed, send email and add to calendar
        if (oldStatus === 'pending' && updates.status === 'confirmed') {
          const r = {
            lastName: data[i][1],
            firstName: data[i][2],
            phone: data[i][3],
            email: data[i][4],
            menuId: data[i][5],
            date: Utilities.formatDate(new Date(data[i][6]), 'Asia/Tokyo', 'yyyy-MM-dd'),
            time: formatTimeValue(data[i][7]),
            guests: data[i][8],
            options: data[i][9] ? JSON.parse(data[i][9]) : [],
            notes: data[i][10],
            massageDuration1: data[i][15] || 0,
            massageDuration2: data[i][16] || 0
          }
          const menus = getMenus().menus
          const menu = menus.find(m => m.id === r.menuId)
          const totalPrice = data[i][12] || 0

          try {
            sendCustomerEmail(r, id, menu, totalPrice, 'confirmed')
          } catch(e) { Logger.log('Approval Email Error: ' + e.message) }
          
          try {
            addToCalendar(r, id, menu, r)
          } catch(e) { Logger.log('Approval Calendar Error: ' + e.message) }
        }
      }
      if (updates.notes !== undefined) {
        sheet.getRange(i + 1, 11).setValue(updates.notes)
      }
      if (updates.totalPrice !== undefined) {
        sheet.getRange(i + 1, 13).setValue(updates.totalPrice)
      }
      sheet.getRange(i + 1, 15).setValue(new Date().toISOString())
      return { success: true }
    }
  }
  return { error: 'Reservation not found' }
}

function cancelReservation(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  const data = sheet.getDataRange().getValues()

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 12).setValue('cancelled')
      sheet.getRange(i + 1, 15).setValue(new Date().toISOString())

      // Update slot count
      const date = Utilities.formatDate(new Date(data[i][6]), 'Asia/Tokyo', 'yyyy-MM-dd')
      updateSlotBookedCount(date, data[i][7], -(data[i][8] || 1))

      return { success: true }
    }
  }
  return { error: 'Reservation not found' }
}

// ===== 枠のカウント更新 =====
function updateSlotBookedCount(date, time, delta) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SLOTS)
  const data = sheet.getDataRange().getValues()

  for (let i = 1; i < data.length; i++) {
    const rowDate = Utilities.formatDate(new Date(data[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd')
    if (rowDate === date && formatTimeValue(data[i][1]) === time) {
      const current = data[i][3] || 0
      sheet.getRange(i + 1, 4).setValue(Math.max(0, current + delta))
      return
    }
  }
}

// マッサージチェア予約状態の更新
function updateSlotMassageChair(date, time, booked) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SLOTS)
  const data = sheet.getDataRange().getValues()

  for (let i = 1; i < data.length; i++) {
    const rowDate = Utilities.formatDate(new Date(data[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd')
    if (rowDate === date && formatTimeValue(data[i][1]) === time) {
      sheet.getRange(i + 1, 6).setValue(booked)
      return
    }
  }
}

// 予約データから予約済みカウントを集計
function getBookedMap() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.RESERVATIONS)
  if (!sheet || sheet.getLastRow() <= 1) return {}

  const data = sheet.getDataRange().getValues()
  const map = {}

  data.slice(1).filter(row => row[0] && row[11] === 'confirmed').forEach(row => {
    const date = Utilities.formatDate(new Date(row[6]), 'Asia/Tokyo', 'yyyy-MM-dd')
    const time = formatTimeValue(row[7])
    const key = date + '_' + time
    const guests = row[8] || 1
    const options = row[9] ? JSON.parse(row[9]) : []

    if (!map[key]) {
      map[key] = { booked: 0, massageChairBooked: false }
    }
    map[key].booked += guests
    if (options.includes('massage-chair')) {
      map[key].massageChairBooked = true
    }
  })

  return map
}
