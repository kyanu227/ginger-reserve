// ===== キャッシュクリア補助関数 =====
function clearCache() {
  const cache = CacheService.getScriptCache()
  // 一般的に操作される当月と翌月のキャッシュをクリアする
  const d1 = new Date()
  const d2 = new Date(d1.getFullYear(), d1.getMonth() + 1, 1)
  const m1 = Utilities.formatDate(d1, 'Asia/Tokyo', 'yyyy-MM')
  const m2 = Utilities.formatDate(d2, 'Asia/Tokyo', 'yyyy-MM')
  cache.removeAll(['app_init_data_' + m1, 'app_init_data_' + m2])
}

// ===== エラーロギング =====
function logError(logs) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.LOGS)
  if (!sheet) return { error: 'Log sheet not found' }

  const rows = logs.map(log => [
    log.timestamp || new Date().toISOString(),
    'frontend',
    log.level || 'ERROR',
    log.message || '',
    log.context || '',
    log.url || '',
    log.userAgent || ''
  ])

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows)
  }
  return { success: true }
}

function logInternalError(source, action, err) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.LOGS)
  if (!sheet) return

  sheet.appendRow([
    new Date().toISOString(),
    'backend',
    'ERROR',
    `[${source}:${action}] ${err.message}`,
    err.stack || '',
    '',
    ''
  ])
}

// ===== CORS対応・エンドポイント =====
function doGet(e) {
  const action = e.parameter.action
  let result = {}

  try {
    switch (action) {
      case 'getMenus':
        result = getMenus()
        break
      case 'getOptions':
        result = getOptions()
        break
      case 'getSlots':
        result = getSlots(e.parameter.month)
        break
      case 'getReservations':
        result = getReservations(e.parameter.status, e.parameter.date)
        break
      case 'getStats':
        result = getStats()
        break
      case 'getProducts':
        result = getProducts()
        break
      case 'getTimeNotices':
        result = getTimeNotices()
        break
      case 'getInitData':
        // Caching performance optimization
        const cache = CacheService.getScriptCache()
        const cached = cache.get('app_init_data_' + e.parameter.month)
        if (cached) {
          result = JSON.parse(cached)
        } else {
          result = {
            menus: getMenus().menus,
            options: getOptions().options,
            slotsResult: getSlots(e.parameter.month), // contains .slots
            settings: getSystemSettings().settings
          }
          // Cache for 5 minutes
          cache.put('app_init_data_' + e.parameter.month, JSON.stringify(result), 300)
        }
        break
      case 'getSystemSettings':
        result = getSystemSettings()
        break
      default:
        result = { error: 'Unknown action' }
    }
  } catch (err) {
    logInternalError('doGet', action, err);
    result = { error: err.message }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents)
  const action = data.action
  let result = {}

  try {
    switch (action) {
      case 'createReservation':
        result = createReservation(data.reservation)
        clearCache()
        break
      case 'updateReservation':
        result = updateReservation(data.id, data.updates)
        clearCache()
        break
      case 'cancelReservation':
        result = cancelReservation(data.id)
        clearCache()
        break
      case 'updateSlots':
        result = updateSlots(data.slots)
        clearCache()
        break
      case 'updateMenu':
        result = updateMenu(data.menus)
        clearCache()
        break
      case 'updateOptions':
        result = updateOptions(data.options)
        clearCache()
        break
      case 'addProduct':
        result = addProduct(data.product)
        break
      case 'updateSystemSettings':
        result = updateSystemSettings(data.settings)
        clearCache()
        break
      case 'checkRepeaterEmail':
        result = checkRepeaterEmail(data.email)
        break
      case 'logError':
        result = logError(data.logs)
        break
      default:
        result = { error: 'Unknown action' }
    }
  } catch (err) {
    logInternalError('doPost', action, err);
    result = { error: err.message }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}
