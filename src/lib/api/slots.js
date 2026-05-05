/**
 * スロット・枠管理
 */

import { collection, doc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { timeToMin, minToTime } from '../constants'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, generateDemoRanges, expandRangesToSlots } from './demo.js'
import { batchWrite } from './init.js'

const normStatus = o => o === true || o === 'open' ? 'open' : o === 'request' ? 'request' : 'closed'

// 時間帯範囲を取得（SlotManagement.jsx 用）
export async function getRanges(month) {
    if (IS_DEMO) return generateDemoRanges(month)
    const cacheKey = `ranges_${month}`
    const hit = cacheGet(cacheKey)
    if (hit) return hit
    const [year, mon] = month.split('-').map(Number)
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const nextYear = mon === 12 ? year + 1 : year
    const nextMon = mon === 12 ? 1 : mon + 1
    const endDate = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`
    const snap = await getDocs(query(
        collection(db, 'slots'),
        where('date', '>=', startDate),
        where('date', '<', endDate)
    ))
    const ranges = snap.docs.map(d => {
        const data = d.data()
        if (data.startTime) {
            // 範囲方式（新形式）
            return { id: d.id, date: data.date, startTime: data.startTime, endTime: data.endTime, status: data.status || 'open' }
        }
        // スロット方式（旧形式 - 後方互換）
        return { id: d.id, date: data.date, startTime: data.time, endTime: minToTime(timeToMin(data.time) + 30), status: normStatus(data.open) }
    })
    cacheSet(cacheKey, ranges, 5 * 60 * 1000) // 5分キャッシュ（予約状況は変わりうるため短め）
    return ranges
}

// 30分スロット配列を返す（ReservationPage 後方互換）
export async function getSlots(month) {
    if (IS_DEMO) return expandRangesToSlots(generateDemoRanges(month))
    return expandRangesToSlots(await getRanges(month))
}

// 時間帯範囲を保存（日付ごとに既存ドキュメントを削除→再書き込み）
// { dates: string[], ranges: {date,startTime,endTime,status}[] }
export async function updateSlots({ dates, ranges }) {
    if (IS_DEMO) return { success: true }
    // 対象日付の既存ドキュメントを一括削除
    const deleteSnaps = await Promise.all(
        dates.map(date => getDocs(query(collection(db, 'slots'), where('date', '==', date))))
    )
    const ops = []
    deleteSnaps.forEach(snap => snap.docs.forEach(d => ops.push({ type: 'delete', ref: d.ref })))
    // 新しい範囲ドキュメントを書き込み（closed/empty は保存しない）
    ranges.forEach(range => {
        ops.push({
            type: 'set',
            ref: doc(db, 'slots', `${range.date}_${range.startTime}_${range.endTime}`),
            data: { date: range.date, startTime: range.startTime, endTime: range.endTime, status: range.status }
        })
    })
    await batchWrite(ops)
    // 更新された月のキャッシュを無効化
    dates.forEach(date => {
        const month = date.substring(0, 7)
        cacheDel(`ranges_${month}`, `booked_${date}`)
    })
    return { success: true }
}
