// ===== 予約枠管理 =====
function getSlots(month) {
  if (!month) {
    const now = new Date()
    month = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM')
  }

  // 月の開始・終了日を計算
  const [year, mon] = month.split('-').map(Number)
  const startDate = new Date(year, mon - 1, 1)
  const endDate = new Date(year, mon, 0) // 月末日

  // 予約済みデータを取得（booked, massageChairBooked の反映用）
  const bookedMap = getBookedMap()

  // 臨時休業日を取得
  const closedDates = getClosedDates()

  // スロットの手動設定（オーバーライド）を取得
  const overridesMap = getSlotOverridesMap()

  // カスタムお知らせを取得
  const customNotices = getCustomNotices()

  // 動的にスロットを生成
  const slots = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // 過去の日付はスキップ
    if (d < today) continue

    const dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd')

    // 臨時休業日チェック
    if (closedDates.includes(dateStr)) continue

    // 営業時間内のスロットを生成
    const startMin = BUSINESS_HOURS.openHour * 60
    const endMin = BUSINESS_HOURS.closeHour * 60
    
    for (let m = startMin; m <= endMin; m += BUSINESS_HOURS.intervalMinutes) {
      const h = Math.floor(m / 60)
      const min = m % 60
      const timeStr = String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0')
      const key = dateStr + '_' + timeStr

      const booked = bookedMap[key]?.booked || 0
      const massageChairBooked = bookedMap[key]?.massageChairBooked || false

      // お知らせ優先順位: 日時指定 > 日指定 > 時間デフォルト
      const notice = customNotices[key]             // 日時指定（例: 2026-02-25_09:00）
                   || customNotices[dateStr]          // 日指定（例: 2026-02-25）
                   || customNotices[timeStr]          // 時間指定（例: 09:00）
                   || DEFAULT_TIME_NOTICES[timeStr]   // デフォルト
                   || null

      const override = overridesMap[key]
      let status = 'closed'
      let capacity = BUSINESS_HOURS.defaultCapacity
      
      if (override) {
        if (override.capacity !== undefined && override.capacity !== '') capacity = override.capacity
        if (override.status !== undefined && override.status !== '') {
          status = override.status
          // 過去のbooleanデータをマイグレーション対応
          if (status === true || status === 'TRUE') status = 'open'
          if (status === false || status === 'FALSE') status = 'closed'
        }
      }

      slots.push({
        date: dateStr,
        time: timeStr,
        capacity: capacity,
        booked: booked,
        open: status, // 'open', 'request', 'closed'
        massageChairBooked: massageChairBooked,
        notice: notice
      })
    }
  }

  return { slots }
}

// 枠の手動設定（開閉状態・キャパシティ変更）を取得
function getSlotOverridesMap() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SLOTS)
  if (!sheet || sheet.getLastRow() <= 1) return {}

  const data = sheet.getDataRange().getValues()
  const map = {}

  data.slice(1).forEach(row => {
    if (!row[0]) return
    const date = Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd')
    const time = formatTimeValue(row[1])
    const key = date + '_' + time
    map[key] = {
      capacity: row[2],
      booked: row[3],
      status: row[4] // E列 (open / request / closed)
    }
  })

  return map
}

// 臨時休業日リストを取得（スプレッドシートから）
function getClosedDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = ss.getSheetByName(SHEET.CLOSED)
  if (!sheet || sheet.getLastRow() <= 1) return []

  const data = sheet.getDataRange().getValues()
  return data.slice(1).filter(row => row[0]).map(row =>
    Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd')
  )
}

// カスタムお知らせをスプレッドシートから取得
// シート列: 日付(任意) | 時間(任意) | メッセージ | タイプ(info/warning)
// 日付のみ → その日の全時間帯に適用
// 時間のみ → 毎日その時間帯に適用
// 両方指定 → その日時のみに適用
function getCustomNotices() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = ss.getSheetByName(SHEET.NOTICES)
  if (!sheet || sheet.getLastRow() <= 1) return {}

  const data = sheet.getDataRange().getValues()
  const map = {}

  data.slice(1).filter(row => row[2]).forEach(row => {
    const date = row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : null
    const time = row[1] ? formatTimeValue(row[1]) : null
    const notice = { message: row[2], type: row[3] || 'info' }

    if (date && time) {
      map[date + '_' + time] = notice   // 日時指定
    } else if (date) {
      map[date] = notice                // 日指定
    } else if (time) {
      map[time] = notice                // 時間指定（デフォルト上書き）
    }
  })

  return map
}

// 時間帯お知らせ一覧を返す
function getTimeNotices() {
  const custom = getCustomNotices()
  return { notices: { ...DEFAULT_TIME_NOTICES, ...custom } }
}

function updateSlots(slots) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SLOTS)
  const data = sheet.getDataRange().getValues()
  
  // マッピングを作成（既存行の高速検索用）
  const existingMap = {}
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue
    const rowDate = Utilities.formatDate(new Date(data[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd')
    const rowTime = formatTimeValue(data[i][1])
    existingMap[rowDate + '_' + rowTime] = i + 1 // GASのエクセル行番号(1始まり)
  }

  const newRows = []

  slots.forEach(slot => {
    const key = slot.date + '_' + slot.time
    const rowNum = existingMap[key]

    if (rowNum) {
      // 既存行の更新
      sheet.getRange(rowNum, 3, 1, 3).setValues([[slot.capacity || 2, slot.booked || 0, slot.open]])
    } else {
      // 新規行の追加用配列にプッシュ
      newRows.push([slot.date, slot.time, slot.capacity || 2, slot.booked || 0, slot.open])
    }
  })

  // 新規行を一括で追加
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows)
  }

  return { success: true }
}
