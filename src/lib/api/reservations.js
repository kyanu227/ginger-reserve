/**
 * 予約管理（CRUD + リピーター判定）
 */

import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where
} from 'firebase/firestore'
import { db } from '../firebase'
import { timeToMin, minToTime } from '../constants'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, DEMO_RESERVATIONS } from './demo.js'
import { callGas, buildCalendarEvents, buildLineMessage, sendLineNotification } from './gas.js'
import { normalizePhone } from './formatters.js'
import { findMatchingCustomer, createCustomer, incrementVisitCount } from './customers.js'
import {
    buildResourceUsages,
    calculateReservationPrice,
    checkResourceCapacity,
    fitsAvailabilityWindows,
    normalizeExistingResourceUsages,
    normalizeResources,
} from '../../domain/reservation'

export async function getReservations(status, date) {
    if (IS_DEMO) {
        let res = [...DEMO_RESERVATIONS]
        if (status && status !== 'all') res = res.filter(r => r.status === status)
        if (date) res = res.filter(r => r.date === date)
        return res
    }
    // orderBy を使うと複合インデックスが必要になるため、クライアント側でソート
    const constraints = []
    if (status && status !== 'all') constraints.push(where('status', '==', status))
    if (date) constraints.push(where('date', '==', date))
    const snap = await getDocs(query(collection(db, 'reservations'), ...constraints))
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export async function getBookedIntervals(date) {
    if (IS_DEMO) return []
    const cacheKey = `booked_${date}`
    const hit = cacheGet(cacheKey)
    if (hit) return hit
    const snap = await getDocs(query(
        collection(db, 'reservations'),
        where('date', '==', date),
        where('status', 'in', ['confirmed', 'pending', 'completed'])
    ))
    const intervals = snap.docs.map(d => {
        const { time, endTime, guests = 1, menuId = '', options = [], massageDuration1 = 0, massageDuration2 = 0, resourceUsages = [] } = d.data()
        const startMin = timeToMin(time)
        const endMin = endTime ? timeToMin(endTime) : startMin + 60
        return { startMin, endMin, guests, menuId, options, massageDuration1, massageDuration2, resourceUsages }
    })
    cacheSet(cacheKey, intervals, 2 * 60 * 1000) // 2分キャッシュ（日付選択のたびの重複読み取りを防ぐ）
    return intervals
}

export async function createReservation(reservation) {
    if (IS_DEMO) {
        const id = 'RES-DEMO' + Date.now().toString(36).toUpperCase()
        return { success: true, id, totalPrice: reservation.totalPrice || 0 }
    }

    const { date, time, guests = 1 } = reservation

    try {
        const [settingsSnap, existingSnap, rangesSnap, menuSnap, menusSnap, optionsSnap, resourcesSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'main')),
            getDocs(query(
                collection(db, 'reservations'),
                where('date', '==', date),
                where('status', 'in', ['confirmed', 'pending'])
            )),
            getDocs(query(collection(db, 'slots'), where('date', '==', date))),
            reservation.menuId ? getDoc(doc(db, 'menus', reservation.menuId)) : Promise.resolve(null),
            getDocs(collection(db, 'menus')),
            getDocs(collection(db, 'options')),
            getDocs(collection(db, 'resources'))
        ])

        const settings = settingsSnap.exists() ? settingsSnap.data() : {}
        const allMenus = menusSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const allOptions = optionsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const resources = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const selectedMenu = allMenus.find(menu => menu.id === reservation.menuId)
            || (menuSnap?.exists() ? { id: menuSnap.id, ...menuSnap.data() } : null)
        const selectedOptionIds = reservation.options || reservation.selectedOptions || []
        const selectedOptions = allOptions.filter(option => selectedOptionIds.includes(option.id))
        const resourcePlan = reservation.resourceUsages?.length
            ? {
                resourceUsages: reservation.resourceUsages,
                arrivalTime: reservation.arrivalTime,
                bathStartTime: reservation.bathStartTime || reservation.time,
                bathEndTime: reservation.bathEndTime || reservation.endTime,
                totalDuration: reservation.totalDuration,
                mainDuration: reservation.mainDuration,
            }
            : buildResourceUsages({
                date,
                bathStartTime: time,
                guests,
                menu: selectedMenu,
                menus: allMenus,
                options: selectedOptions,
                selectedDuration: reservation.selectedDuration || reservation.duration,
                massageDuration1: reservation.massageDuration1 || 0,
                massageDuration2: reservation.massageDuration2 || 0,
            })
        const activeResources = normalizeResources(resources, settings)
        const ranges = rangesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const fit = fitsAvailabilityWindows(resourcePlan.resourceUsages, ranges)
        if (!fit.ok) return { success: false, error: fit.message || '予約枠外の時間は選択できません' }

        const existingReservations = existingSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const existingUsages = normalizeExistingResourceUsages(existingReservations, {
            menus: allMenus,
            options: allOptions,
            date,
        })
        const capacity = checkResourceCapacity(resourcePlan.resourceUsages, existingUsages, activeResources)
        if (!capacity.ok) {
            const isMassage = capacity.resourceId === 'massageChair'
            return { success: false, error: isMassage ? 'この時間帯はマッサージチェアが満席です' : 'この時間帯は定員に達しています' }
        }

        const totalPrice = reservation.totalPrice || calculateReservationPrice({
            menu: selectedMenu,
            options: selectedOptions,
            guests,
            visitCount: reservation.visitCount || 0,
            variantId: reservation.variantId,
        }).totalPrice
        const newStartMin = timeToMin(resourcePlan.bathStartTime || time)
        const endTime = resourcePlan.bathEndTime || minToTime(newStartMin + (resourcePlan.mainDuration || 0))

        // 予約期間全体（開始〜終了）を含む時間帯範囲を検索（範囲方式・旧スロット方式の両対応）
        const coveringRange = ranges
            .find(r => {
                const s = r.startTime ? timeToMin(r.startTime) : timeToMin(r.time || '00:00')
                const e = r.endTime   ? timeToMin(r.endTime)   : s + 30
                return resourcePlan.resourceUsages.every(usage => s <= usage.startMin && usage.endMin <= e)
            })
        if (!coveringRange) return { success: false, error: '予約枠外の時間は選択できません' }

        // 時間帯ステータスから confirmed/pending を決定
        let initialStatus = 'confirmed'
        if (coveringRange?.status === 'request' || coveringRange?.open === 'request') {
            initialStatus = 'pending'
        }

        const resId = `RES-${Date.now().toString(36).toUpperCase()}`
        const now = new Date().toISOString()
        const { selectedOptions: _selectedOptions, ...resWithoutSelectedOptions } = reservation
        const resData = {
            ...resWithoutSelectedOptions,
            id: resId,
            options: selectedOptionIds,
            endTime,
            bathStartTime: resourcePlan.bathStartTime || time,
            bathEndTime: resourcePlan.bathEndTime || endTime,
            arrivalTime: resourcePlan.arrivalTime || time,
            totalDuration: resourcePlan.totalDuration || 0,
            mainDuration: resourcePlan.mainDuration || 0,
            totalPrice,
            resourceUsages: resourcePlan.resourceUsages,
            status: initialStatus,
            createdAt: now,
            updatedAt: now
        }

        await setDoc(doc(db, 'reservations', resId), resData)

        // Google カレンダーに登録（confirmed の場合のみ）
        if (initialStatus === 'confirmed') {
            try {
                const menu = menuSnap?.exists() ? { id: menuSnap.id, ...menuSnap.data() } : null
                const calendarId = settings.calendarId || ''
                const events = buildCalendarEvents({ ...resData, id: resId }, menu)
                const calResult = await callGas('addToCalendar', { events, calendarId })
                if (calResult?.eventIds?.length) {
                    await updateDoc(doc(db, 'reservations', resId), { calendarEventIds: calResult.eventIds })
                }
                // LINE通知（fire-and-forget）
                const lineGroupId = settings.lineGroupId || ''
                if (lineGroupId) {
                    const msg = buildLineMessage({ ...resData, id: resId }, menu, initialStatus)
                    sendLineNotification(msg, lineGroupId).catch(e => console.error('[LINE create]', e))
                }
            } catch (e) { console.error('[calendar create]', e) }
        } else if (initialStatus === 'pending') {
            // リクエスト予約のLINE通知
            try {
                const lineGroupId = settings.lineGroupId || ''
                if (lineGroupId) {
                    const menu = menuSnap?.exists() ? { id: menuSnap.id, ...menuSnap.data() } : null
                    const msg = buildLineMessage({ ...resData, id: resId }, menu, 'pending')
                    sendLineNotification(msg, lineGroupId).catch(e => console.error('[LINE request]', e))
                }
            } catch (e) { console.error('[LINE request]', e) }
        }

        // 顧客名簿と自動リンク
        try {
            let customerId = reservation.customerId || null
            if (!customerId) {
                // 既存顧客を検索
                const match = await findMatchingCustomer({
                    lastName: reservation.lastName,
                    firstName: reservation.firstName,
                    phone: reservation.phone,
                    email: reservation.email
                })
                if (match) {
                    customerId = match.id
                } else {
                    // 新規顧客を作成
                    const result = await createCustomer({
                        lastName: reservation.lastName || '',
                        firstName: reservation.firstName || '',
                        phone: reservation.phone || '',
                        email: reservation.email || ''
                    })
                    if (result.success) customerId = result.id
                }
            }
            // 予約に customerId をリンク
            if (customerId) {
                await updateDoc(doc(db, 'reservations', resId), { customerId })
            }
        } catch (e) { console.error('[customer link]', e) }

        cacheDel(`booked_${date}`) // 予約後は当日の空き情報キャッシュを無効化
        return { success: true, id: resId, totalPrice }
    } catch (err) {
        console.error('createReservation error:', err)
        return { success: false, error: err.message }
    }
}

export async function updateReservation(id, updates) {
    if (IS_DEMO) return { success: true }
    try {
        await updateDoc(doc(db, 'reservations', id), {
            ...updates,
            updatedAt: new Date().toISOString()
        })

        // confirmed/pending → completed に遷移した場合、visitCount をインクリメント
        if (updates.status === 'completed') {
            try {
                const resSnap = await getDoc(doc(db, 'reservations', id))
                if (resSnap.exists()) {
                    const resData = resSnap.data()
                    if (resData.customerId) {
                        await incrementVisitCount(resData.customerId, resData.date || '')
                    }
                }
            } catch (e) { console.error('[visitCount increment]', e) }
        }

        // pending → confirmed に昇格した場合、カレンダー登録 + LINE通知
        if (updates.status === 'confirmed') {
            try {
                const resSnap = await getDoc(doc(db, 'reservations', id))
                if (resSnap.exists()) {
                    const resData = resSnap.data()
                    const settingsCache = cacheGet('settings') || {}
                    const calendarId   = settingsCache.calendarId  || ''
                    const lineGroupId  = settingsCache.lineGroupId || ''
                    const menuSnap = resData.menuId
                        ? await getDoc(doc(db, 'menus', resData.menuId))
                        : null
                    const menu = menuSnap?.exists() ? { id: menuSnap.id, ...menuSnap.data() } : null
                    // まだカレンダー登録されていない場合のみ
                    if (!resData.calendarEventIds?.length) {
                        const events = buildCalendarEvents({ ...resData, id }, menu)
                        const calResult = await callGas('addToCalendar', { events, calendarId })
                        if (calResult?.eventIds?.length) {
                            await updateDoc(doc(db, 'reservations', id), { calendarEventIds: calResult.eventIds })
                        }
                    }
                    // LINE通知（承認確定）
                    if (lineGroupId) {
                        const msg = buildLineMessage({ ...resData, id }, menu, 'confirmed')
                        sendLineNotification(msg, lineGroupId).catch(e => console.error('[LINE approve]', e))
                    }
                }
            } catch (e) { console.error('[calendar approve]', e) }
        }

        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

export async function cancelReservation(id) {
    if (IS_DEMO) return { success: true }
    try {
        // 1回だけ読んでカレンダー削除とキャッシュ無効化の両方に使う
        const resSnap = await getDoc(doc(db, 'reservations', id))
        if (resSnap.exists()) {
            const resData = resSnap.data()
            // カレンダーイベントを削除
            if (resData.calendarEventIds?.length) {
                const calendarId = (cacheGet('settings') || {}).calendarId || ''
                try {
                    await callGas('deleteFromCalendar', { eventIds: resData.calendarEventIds, calendarId })
                } catch (e) { console.error('[calendar cancel]', e) }
            }
            // 当日の booked キャッシュを無効化
            if (resData.date) cacheDel(`booked_${resData.date}`)
        }

        await updateDoc(doc(db, 'reservations', id), {
            status: 'cancelled',
            updatedAt: new Date().toISOString()
        })
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

/**
 * リピーター判定 — findMatchingCustomer を使い、customerId も返す
 * 予約フォームの Step 0 完了時に呼ばれる
 */
export async function checkRepeater({ email, phone, lastName, firstName }) {
    // findMatchingCustomer はデモモード対応済み
    const match = await findMatchingCustomer({ lastName, firstName, phone, email })
    if (match) {
        return { isRepeater: true, visitCount: match.visitCount || 0, customerId: match.id }
    }
    return { isRepeater: false, visitCount: 0, customerId: null }
}
