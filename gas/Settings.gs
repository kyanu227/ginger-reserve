// ===== メニュー管理 =====
function getMenus() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.MENU)
  if (!sheet) return { menus: [] }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { menus: [] }

  const headers = data[0]
  const menus = data.slice(1).filter(row => row[0]).map(row => ({
    id: row[0],
    name: row[1],
    category: row[2],
    price: row[3],
    duration: row[4],
    description: row[5],
    icon: row[6],
    active: row[7] !== false && row[7] !== 'FALSE'
  }))
  return { menus }
}

function updateMenu(menus) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.MENU)
  // Clear and rewrite
  const lastRow = sheet.getLastRow()
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 8).clearContent()

  menus.forEach((m, i) => {
    sheet.getRange(i + 2, 1, 1, 8).setValues([[
      m.id, m.name, m.category, m.price, m.duration, m.description, m.icon, m.active
    ]])
  })
  return { success: true }
}

// ===== オプション管理 =====
function getOptions() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.OPTIONS)
  if (!sheet) return { options: [] }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { options: [] }

  const options = data.slice(1).filter(row => row[0]).map(row => ({
    id: row[0],
    name: row[1],
    price: row[2],
    description: row[3],
    icon: row[4],
    constraint: row[5],
    active: row[6] !== false && row[6] !== 'FALSE'
  }))
  return { options }
}

function updateOptions(options) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.OPTIONS)
  const lastRow = sheet.getLastRow()
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 7).clearContent()

  options.forEach((o, i) => {
    sheet.getRange(i + 2, 1, 1, 7).setValues([[
      o.id, o.name, o.price, o.description, o.icon, o.constraint, o.active
    ]])
  })
  return { success: true }
}

// ===== 物販管理 =====
function getProducts() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.PRODUCTS)
  if (!sheet) return { products: [] }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { products: [] }

  const products = data.slice(1).filter(row => row[0]).map(row => ({
    id: row[0],
    date: Utilities.formatDate(new Date(row[1]), 'Asia/Tokyo', 'yyyy-MM-dd'),
    productName: row[2],
    price: row[3],
    quantity: row[4],
    customerName: row[5],
    notes: row[6]
  }))
  return { products }
}

function addProduct(p) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.PRODUCTS)
  const id = 'PRD-' + new Date().getTime().toString(36).toUpperCase()
  sheet.appendRow([id, new Date(), p.productName, p.price, p.quantity || 1, p.customerName || '', p.notes || ''])
  return { success: true, id: id }
}

// ===== 統計 =====
function getStats() {
  const reservations = getReservations().reservations
  const menus = getMenus().menus

  // Monthly revenue & count
  const monthly = {}
  reservations.forEach(r => {
    if (r.status === 'cancelled') return
    const month = r.date.substring(0, 7)
    if (!monthly[month]) monthly[month] = { count: 0, revenue: 0 }
    monthly[month].count++
    monthly[month].revenue += r.totalPrice || 0
  })

  // Course popularity
  const courseStats = {}
  reservations.forEach(r => {
    if (r.status === 'cancelled') return
    const menu = menus.find(m => m.id === r.menuId)
    const name = menu ? menu.name : r.menuId
    if (!courseStats[name]) courseStats[name] = 0
    courseStats[name]++
  })

  // Hourly distribution
  const hourly = {}
  for (let h = 9; h < 19; h++) hourly[h + ':00'] = 0
  reservations.forEach(r => {
    if (r.status === 'cancelled') return
    const hour = parseInt(r.time.split(':')[0])
    const key = hour + ':00'
    if (hourly[key] !== undefined) hourly[key]++
  })

  // Day of week distribution
  const dayOfWeek = { '月': 0, '火': 0, '水': 0, '木': 0, '金': 0, '土': 0, '日': 0 }
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  reservations.forEach(r => {
    if (r.status === 'cancelled') return
    const day = dayNames[new Date(r.date).getDay()]
    dayOfWeek[day]++
  })

  // New vs repeat (simple: count by email)
  const emailCount = {}
  reservations.forEach(r => {
    if (r.status === 'cancelled') return
    if (!emailCount[r.email]) emailCount[r.email] = 0
    emailCount[r.email]++
  })
  const newCustomers = Object.values(emailCount).filter(c => c === 1).length
  const repeatCustomers = Object.values(emailCount).filter(c => c > 1).length

  // Cancel rate
  const total = reservations.length
  const cancelled = reservations.filter(r => r.status === 'cancelled').length
  const confirmed = reservations.filter(r => r.status !== 'cancelled').length

  // Total revenue
  const totalRevenue = reservations.filter(r => r.status !== 'cancelled')
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0)

  return {
    monthly: Object.entries(monthly).map(([month, d]) => ({ month, ...d })).sort((a, b) => a.month.localeCompare(b.month)),
    courseStats: Object.entries(courseStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    hourly: Object.entries(hourly).map(([hour, count]) => ({ hour, count })),
    dayOfWeek: Object.entries(dayOfWeek).map(([day, count]) => ({ day, count })),
    newCustomers,
    repeatCustomers,
    totalRevenue,
    confirmed,
    cancelled,
    cancelRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0'
  }
}
