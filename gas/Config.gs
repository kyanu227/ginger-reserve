/**
 * 酵素風呂 予約システム — Google Apps Script Backend
 * 
 * このスクリプトをGASエディタに貼り付けて「ウェブアプリとしてデプロイ」してください。
 * スプレッドシートID は下の SPREADSHEET_ID に設定してください。
 */

// ===== 設定 =====
const SPREADSHEET_ID = '1L94cIUiOv4QQYpI5qogXG_xGSlj8kS2w8xdUinlewCY'
const ADMIN_EMAILS = ['admin@example.com'] // 管理者メールアドレス（通知先）
const BUSINESS_NAME = '酵素風呂'
const CALENDAR_ID = 'primary' // Googleカレンダー（primaryは自分のメインカレンダー）

// ===== スプレッドシートのシート名 =====
const SHEET = {
  MENU: 'メニュー',
  OPTIONS: 'オプション',
  SLOTS: '予約枠',
  RESERVATIONS: '予約データ',
  PRODUCTS: '物販',
  SETTINGS: '設定',
  NOTICES: 'お知らせ',
  CLOSED: '臨時休業',
  LOGS: 'エラーログ'
}

// ===== 営業設定 =====
const BUSINESS_HOURS = {
  openHour: 9,
  closeHour: 21,   // 最終受付21:00
  intervalMinutes: 30, // 30分間隔に変更
  defaultCapacity: 2
}

// 時間帯ごとのデフォルトお知らせ
const DEFAULT_TIME_NOTICES = {
  '09:00': { message: '🌡️ この時間帯はぬるい可能性があります', type: 'info' },
  '10:00': { message: '🌡️ この時間帯はぬるい可能性があります', type: 'info' },
  '20:00': { message: '🌙 最終受付の1時間前です', type: 'info' },
  '21:00': { message: '🌙 最終受付時間です', type: 'info' }
}

// ===== 初期セットアップ =====
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)

  // メニューシート
  let sheet = ss.getSheetByName(SHEET.MENU) || ss.insertSheet(SHEET.MENU)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', '名前', 'カテゴリ', '料金', '所要時間(分)', '説明', 'アイコン', '有効'])
    sheet.appendRow(['enzyme-first', '酵素風呂（初回）', 'main', 3900, 20, '初めてのお客様向け', '🌿', true])
    sheet.appendRow(['enzyme-regular', '酵素風呂（通常）', 'main', 2900, 20, '通常コース', '🌿', true])
    sheet.appendRow(['enzyme-bring', '酵素風呂（持参）', 'main', 1900, 20, '酵素着持参・最低限サポート', '🌿', true])
    sheet.appendRow(['yomogi', 'よもぎ蒸し', 'main', 3900, 30, 'よもぎ蒸しコース', '🌱', true])
  }

  // オプションシート
  sheet = ss.getSheetByName(SHEET.OPTIONS) || ss.insertSheet(SHEET.OPTIONS)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', '名前', '料金', '説明', 'アイコン', '制約', '有効'])
    sheet.appendRow(['massage-chair', 'マッサージチェア', 0, '酵素風呂の入浴前にご利用いただけます（20〜30分）', '💆', 'enzyme-before', true])
    sheet.appendRow(['juice', 'ジュース', 300, '新鮮なジュース', '🥤', '', true])
    sheet.appendRow(['nuka-pack', '米糠パック', 500, '米糠パック', '🧴', '', true])
  }

  // 予約枠シート
  sheet = ss.getSheetByName(SHEET.SLOTS) || ss.insertSheet(SHEET.SLOTS)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['日付', '時間', '定員', '予約済', '解放', 'マッサージチェア予約済'])
  }

  // 予約データシート
  sheet = ss.getSheetByName(SHEET.RESERVATIONS) || ss.insertSheet(SHEET.RESERVATIONS)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', '姓', '名', '電話', 'メール', 'メニューID', '日付', '時間', '人数', 'オプション', '備考', 'ステータス', '合計金額', '作成日時', '更新日時', 'マッサージ時間1', 'マッサージ時間2'])
  }

  // 物販シート
  sheet = ss.getSheetByName(SHEET.PRODUCTS) || ss.insertSheet(SHEET.PRODUCTS)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', '日付', '商品名', '料金', '数量', 'お客様名', '備考'])
  }

  // 設定シート
  sheet = ss.getSheetByName(SHEET.SETTINGS) || ss.insertSheet(SHEET.SETTINGS)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['項目', '値'])
    sheet.appendRow(['営業開始', '09:00'])
    sheet.appendRow(['営業終了', '21:00'])
    sheet.appendRow(['同時最大人数', 2])
    sheet.appendRow(['マッサージチェア台数', 1])
    sheet.appendRow(['repeaterMenuName', '酵素風呂 (2回目以降)'])
    sheet.appendRow(['repeaterDiscountAmount', 2900])
    sheet.appendRow(['repeaterOptionName', '自前酵素着なし（レンタル）'])
    sheet.appendRow(['repeaterOptionPrice', 1000])
  }

  // お知らせシート
  sheet = ss.getSheetByName(SHEET.NOTICES) || ss.insertSheet(SHEET.NOTICES)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['日付（空欄=毎日）', '時間（空欄=終日）', 'メッセージ', 'タイプ(info/warning)'])
    sheet.appendRow(['', '09:00', '🌡️ この時間帯はぬるい可能性があります', 'info'])
    sheet.appendRow(['', '10:00', '🌡️ この時間帯はぬるい可能性があります', 'info'])
  }

  // 臨時休業シート
  sheet = ss.getSheetByName(SHEET.CLOSED) || ss.insertSheet(SHEET.CLOSED)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['日付', '理由（任意）'])
  }

  return 'セットアップ完了！'
}

// ===== システム設定 (Settings) =====
function getSystemSettings() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SETTINGS)
  if (!sheet) return { settings: {} }
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return { settings: {} }

  const settings = {}
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0]
    const value = data[i][1]
    if (key) {
      settings[key] = value
    }
  }
  return { settings }
}

function updateSystemSettings(newSettings) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SETTINGS)
  if (!sheet) return { error: 'Settings sheet not found' }
  const data = sheet.getDataRange().getValues()

  // Iterate over new settings and update or insert
  for (const key of Object.keys(newSettings)) {
    let found = false
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(newSettings[key])
        found = true
        break
      }
    }
    // If key not found, append a new row
    if (!found) {
      sheet.appendRow([key, newSettings[key]])
    }
  }
  return { success: true }
}
