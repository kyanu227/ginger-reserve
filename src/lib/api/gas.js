/**
 * GAS Webhook 連携（Google Calendar / LINE）
 */

import { timeToMin, minToTime, DAY_LABELS } from '../constants'
import { cacheGet } from './cache.js'

// logger.js との後方互換性のために残す
export const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || ''

// .env の値はフォールバック。Firestore settings.gasApiUrl / settings.gasSecret が優先される
export const _GAS_URL_ENV    = import.meta.env.VITE_GAS_API_URL    || ''
export const _GAS_SECRET_ENV = import.meta.env.VITE_GAS_CAL_SECRET || ''

// 予約データからカレンダーイベント配列を構築（マッサージチェア→メインの直列タイムライン）
export function buildCalendarEvents(resData, menu) {
    const { date, time, guests = 1, options = [], massageDuration1 = 0, massageDuration2 = 0,
            lastName, firstName, phone, email, notes, id: resId } = resData
    const name        = `${lastName}${firstName}様`
    const guestSuffix = guests >= 2 ? ` × ${guests}名` : ''
    const hasMassage  = (options || []).includes('massage-chair')
    const events      = []
    let curMin        = timeToMin(time)

    // ① マッサージチェア（1人目→2人目の直列）
    if (hasMassage) {
        const mcMin = (massageDuration1 || 20) + (guests >= 2 ? (massageDuration2 || 20) : 0)
        events.push({
            title:       `🪑 ${name} マッサージチェア${guestSuffix}`,
            date,
            startTime:   minToTime(curMin),
            endTime:     minToTime(curMin + mcMin),
            description: `予約番号: ${resId || ''}\n電話: ${phone || ''}`
        })
        curMin += mcMin
    }

    // ② メインコース
    const baseDuration = menu?.duration || 20
    const otherOpts    = (options || []).filter(o => o !== 'massage-chair')
    const optNote      = otherOpts.length ? `\nオプション: ${otherOpts.join(', ')}` : ''
    events.push({
        title:       `${menu?.icon || '🌿'} ${name} ${menu?.name || 'ご予約'}${guestSuffix}`,
        date,
        startTime:   minToTime(curMin),
        endTime:     minToTime(curMin + baseDuration),
        description: `予約番号: ${resId || ''}\n電話: ${phone || ''}\nメール: ${email || ''}${optNote}\n備考: ${notes || 'なし'}`
    })
    return events
}

// GAS Webhook 汎用呼び出し（fire-and-forget 可）
// URL と Secret はキャッシュ済み settings から動的取得（追加Firestoreリードなし）
export async function callGas(action, payload) {
    const s = cacheGet('settings') || {}
    const url    = s.gasApiUrl  || _GAS_URL_ENV
    const secret = s.gasSecret  || _GAS_SECRET_ENV
    if (!url) return null
    try {
        // Content-Type を省略 (=text/plain) することで CORS プリフライト (OPTIONS) を回避
        // GAS の doPost は Content-Type に関係なく e.postData.contents でボディを読める
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action, secret, ...payload })
        })
        return await res.json()
    } catch (e) {
        console.error('[callGas]', action, e)
        return null
    }
}

// LINEメッセージ本文を生成
export function buildLineMessage(resData, menu, type) {
    const { date, time, lastName, firstName, guests = 1, totalPrice } = resData
    const d = new Date(date + 'T00:00:00')
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`
    const menuName = menu?.name || resData.menuId || ''
    const header = type === 'confirmed' ? '【新規予約】' : '【予約リクエスト】'
    const footer = type === 'confirmed'
        ? `💴 ¥${Number(totalPrice || 0).toLocaleString()}`
        : '⚠️ 承認待ち'
    return `${header}\n📅 ${dateStr} ${time}〜\n👤 ${lastName}${firstName}\n🌿 ${menuName} × ${guests}名\n${footer}`
}

export async function sendLineNotification(message, groupId) {
    if (!groupId) return null
    return callGas('sendLineNotification', { message, groupId })
}

export async function saveLineToken(token) {
    return callGas('saveLineToken', { lineToken: token })
}

export async function getLineTokenStatus() {
    return callGas('getLineTokenStatus', {})
}

export async function getLineBotInfo() {
    return callGas('getLineBotInfo', {})
}

// 予約確認メールを送信（GAS MailApp 経由）
export async function sendConfirmationEmail(reservationId, { to, customerName, date, time, menuName, totalPrice, guests }) {
    const d = new Date(date + 'T00:00:00')
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`
    const body = `
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <h2 style="color:#3A5F56;border-bottom:2px solid #3A5F56;padding-bottom:10px;">ご予約確認</h2>
  <p>${customerName} 様</p>
  <p>ご予約ありがとうございます。以下の内容で承りました。</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;width:100px;">日時</td><td style="padding:8px;border-bottom:1px solid #eee;">${dateStr} ${time}〜</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">コース</td><td style="padding:8px;border-bottom:1px solid #eee;">${menuName}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">人数</td><td style="padding:8px;border-bottom:1px solid #eee;">${guests}名</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">合計金額</td><td style="padding:8px;">¥${Number(totalPrice || 0).toLocaleString()}</td></tr>
  </table>
  <p style="color:#666;font-size:0.9em;">※ キャンセル・変更はお電話にてご連絡ください。</p>
  <p style="margin-top:24px;color:#3A5F56;font-weight:bold;">酵素風呂 Ginger</p>
</div>`.trim()

    return callGas('sendConfirmationEmail', {
        reservationId,
        to,
        subject: '【酵素風呂Ginger】ご予約確認',
        body,
    })
}
