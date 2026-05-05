/**
 * デモモード判定・デモ用データ
 * VITE_FIREBASE_PROJECT_ID が未設定の場合はデモモードで動作
 */

import { timeToMin, minToTime } from '../constants'
import { DEFAULT_RESOURCES, RESOURCE_IDS, RESOURCE_PHASES, buildResourceUsages } from '../../domain/reservation'

// Firebase 設定がなければデモモード
export const IS_DEMO = !import.meta.env.VITE_FIREBASE_PROJECT_ID

// ===== デモ用データ（Firebase未設定時に使用） =====
export const DEMO_RESOURCES = DEFAULT_RESOURCES

const enzymeBathRequirement = {
    resourceId: RESOURCE_IDS.ENZYME_BATH,
    phase: RESOURCE_PHASES.MAIN,
    durationMinutes: 20,
    units: 'guests',
}

const yomogiRoomRequirement = {
    resourceId: RESOURCE_IDS.YOMOGI_ROOM,
    phase: RESOURCE_PHASES.MAIN,
    durationMinutes: 30,
    units: 'guests',
}

export const DEMO_MENUS = [
    // ── カテゴリ ────────────────────────────────────────────────────────
    { id: 'cat-enzyme', name: '酵素風呂', icon: '🌿', description: '天然酵素の力で心身を芯から温めます', isCategory: true, parentId: null, active: true, maxPeople: 2, categoryKey: 'enzyme', resourceId: RESOURCE_IDS.ENZYME_BATH, order: 0 },
    { id: 'cat-yomogi', name: 'よもぎ蒸し', icon: '🌾', description: 'よもぎのミストで体を温め、デトックス効果を促します', isCategory: true, parentId: null, active: true, maxPeople: 1, categoryKey: 'yomogi', resourceId: RESOURCE_IDS.YOMOGI_ROOM, order: 10 },
    // ── 酵素風呂 サブメニュー ────────────────────────────────────────────
    { id: 'enzyme-set', name: 'セットメニュー', icon: '✨', parentId: 'cat-enzyme', isCategory: false, category: 'main', categoryKey: 'enzyme', price: 3900, duration: 20, durationMinutes: 20, durations: [20], maxPeople: 2, minVisits: 0, description: '酵素風呂＋ジュース＋パック付きのフルセット（初回の方はこちら）', active: true, visibility: 'all', resourceRequirements: [enzymeBathRequirement], variants: [{ id: 'firstTime', name: '初回', price: 3900, minVisits: -1, active: true }, { id: 'repeatWithWear', name: 'リピーター・レンタルあり', price: 2900, minVisits: 1, active: true }], order: 1 },
    { id: 'enzyme-rental', name: 'レンタルメニュー', icon: '👘', parentId: 'cat-enzyme', isCategory: false, category: 'main', categoryKey: 'enzyme', price: 2900, duration: 20, durationMinutes: 20, durations: [20], maxPeople: 2, minVisits: 1, description: '入浴グッズレンタル付きコース', active: true, visibility: 'repeater', resourceRequirements: [enzymeBathRequirement], order: 2 },
    { id: 'enzyme-solo', name: '単品', icon: '🛁', parentId: 'cat-enzyme', isCategory: false, category: 'main', categoryKey: 'enzyme', price: 1900, duration: 20, durationMinutes: 20, durations: [20], maxPeople: 2, minVisits: 1, description: '入浴着・タオル等の6点セットをご持参の方向け', active: true, visibility: 'repeater', resourceRequirements: [enzymeBathRequirement], order: 3 },
    // ── よもぎ蒸し サブメニュー ─────────────────────────────────────────
    { id: 'yomogi-set', name: 'セットメニュー', icon: '✨', parentId: 'cat-yomogi', isCategory: false, category: 'main', categoryKey: 'yomogi', price: 3900, duration: 30, durationMinutes: 30, durations: [30], maxPeople: 1, minVisits: 0, description: 'よもぎ蒸し＋ドリンク付きフルセット', active: true, visibility: 'all', resourceRequirements: [yomogiRoomRequirement], order: 11 },
    { id: 'yomogi-solo', name: '単品', icon: '🌱', parentId: 'cat-yomogi', isCategory: false, category: 'main', categoryKey: 'yomogi', price: 2900, duration: 30, durationMinutes: 30, durations: [30], maxPeople: 1, minVisits: 1, description: 'タオル等をご持参の方向け単品コース', active: true, visibility: 'repeater', resourceRequirements: [yomogiRoomRequirement], order: 12 },
]

export const DEMO_OPTIONS = [
    { id: 'massage-chair', name: 'マッサージチェア', price: 0, description: '入浴前にご利用いただけます（10〜30分）', icon: '', active: true, order: 0, units: 1, durations: [10, 20, 30], selectableDurations: [10, 20, 30], isTimedResource: true, timing: RESOURCE_PHASES.BEFORE_MAIN, sequentialPerGuest: true, eligibleMenuCategories: ['enzyme', 'yomogi'], resourceRequirements: [{ resourceId: RESOURCE_IDS.MASSAGE_CHAIR, phase: RESOURCE_PHASES.BEFORE_MAIN, capacityUnits: 1, durationSource: 'selectedDurationPerGuest' }] },
    { id: 'juice', name: '季節のお飲み物', price: 500, description: '季節のフルーツを使ったお飲み物', icon: '', active: true, order: 1, units: 0, durations: [], isTimedResource: false },
    { id: 'nuka-pack', name: '米糠パック', price: 500, description: 'お肌に優しい米糠パック', icon: '', active: true, order: 2, units: 0, durations: [], isTimedResource: false },
]

export const DEMO_SETTINGS = {
    '営業開始': '09:00',
    '営業終了': '21:00',
}

// ===== デモ用顧客データ（名簿連携用） =====
export const DEMO_CUSTOMERS = [
    { id: 'cust-demo-001', lastName: '山田', firstName: '太郎', lastNameKana: 'ヤマダ', firstNameKana: 'タロウ', phone: '090-1234-1000', phoneNorm: '09012341000', email: 'yamada@example.com', visitCount: 5, lastVisitDate: '2026-03-10', memo: '常連のお客様。酵素風呂をいつもご利用。', createdAt: '2025-12-01T10:00:00.000Z', lastUpdated: '2026-03-10T10:00:00.000Z' },
    { id: 'cust-demo-002', lastName: '佐藤', firstName: '花子', lastNameKana: 'サトウ', firstNameKana: 'ハナコ', phone: '090-1234-1001', phoneNorm: '09012341001', email: 'sato@example.com', visitCount: 3, lastVisitDate: '2026-03-08', memo: '', createdAt: '2026-01-10T10:00:00.000Z', lastUpdated: '2026-03-08T10:00:00.000Z' },
    { id: 'cust-demo-003', lastName: '田中', firstName: '一郎', lastNameKana: 'タナカ', firstNameKana: 'イチロウ', phone: '090-1234-1002', phoneNorm: '09012341002', email: 'tanaka@example.com', visitCount: 2, lastVisitDate: '2026-03-05', memo: 'よもぎ蒸しがお気に入り', createdAt: '2026-01-20T10:00:00.000Z', lastUpdated: '2026-03-05T10:00:00.000Z' },
    { id: 'cust-demo-004', lastName: '鈴木', firstName: '美咲', lastNameKana: 'スズキ', firstNameKana: 'ミサキ', phone: '090-1234-1003', phoneNorm: '09012341003', email: 'suzuki@example.com', visitCount: 7, lastVisitDate: '2026-03-12', memo: 'マッサージチェア必須', createdAt: '2025-11-15T10:00:00.000Z', lastUpdated: '2026-03-12T10:00:00.000Z' },
    { id: 'cust-demo-005', lastName: '高橋', firstName: '健一', lastNameKana: 'タカハシ', firstNameKana: 'ケンイチ', phone: '090-1234-1004', phoneNorm: '09012341004', email: 'takahashi@example.com', visitCount: 1, lastVisitDate: '2026-02-20', memo: '', createdAt: '2026-02-20T10:00:00.000Z', lastUpdated: '2026-02-20T10:00:00.000Z' },
    { id: 'cust-demo-006', lastName: '伊藤', firstName: '麻衣', lastNameKana: 'イトウ', firstNameKana: 'マイ', phone: '090-1234-1005', phoneNorm: '09012341005', email: 'ito@example.com', visitCount: 4, lastVisitDate: '2026-03-14', memo: '', createdAt: '2025-12-20T10:00:00.000Z', lastUpdated: '2026-03-14T10:00:00.000Z' },
    { id: 'cust-demo-007', lastName: '渡辺', firstName: '翔太', lastNameKana: 'ワタナベ', firstNameKana: 'ショウタ', phone: '090-1234-1006', phoneNorm: '09012341006', email: 'watanabe@example.com', visitCount: 2, lastVisitDate: '2026-03-01', memo: '', createdAt: '2026-01-05T10:00:00.000Z', lastUpdated: '2026-03-01T10:00:00.000Z' },
    { id: 'cust-demo-008', lastName: '小林', firstName: '直子', lastNameKana: 'コバヤシ', firstNameKana: 'ナオコ', phone: '090-1234-1007', phoneNorm: '09012341007', email: 'kobayashi@example.com', visitCount: 0, lastVisitDate: '', memo: '初回予約済み・未来店', createdAt: '2026-03-15T10:00:00.000Z', lastUpdated: '2026-03-15T10:00:00.000Z' },
]

// デモ用時間帯データの生成（範囲方式）
export function generateDemoRanges(month) {
    const ranges = []
    const [year, mon] = month ? month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
    const daysInMonth = new Date(year, mon, 0).getDate()
    const today = new Date(); today.setHours(0, 0, 0, 0)

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (new Date(year, mon - 1, d).getDay() === 0) continue // 日曜休業
        if (new Date(dateStr) < today) continue
        // 午前: 09:00〜12:00
        if (Math.random() > 0.2)
            ranges.push({ id: `demo_${dateStr}_am`, date: dateStr, startTime: '09:00', endTime: '12:00', status: 'open' })
        // 午後: 13:00〜19:00
        if (Math.random() > 0.3)
            ranges.push({ id: `demo_${dateStr}_pm`, date: dateStr, startTime: '13:00', endTime: '19:00', status: 'open' })
    }
    return ranges
}

// 時間帯範囲 → 10分スロット配列（ReservationPage 互換）
export function expandRangesToSlots(ranges) {
    const slots = []
    ranges.forEach(({ date, startTime, endTime, status }) => {
        let m = timeToMin(startTime), em = timeToMin(endTime)
        while (m < em) { slots.push({ date, time: minToTime(m), open: status }); m += 10 }
    })
    return slots
}

// デモ用予約データ
export const DEMO_RESERVATIONS = (() => {
    const reservations = []
    const names = [
        { lastName: '山田', firstName: '太郎' }, { lastName: '佐藤', firstName: '花子' },
        { lastName: '田中', firstName: '一郎' }, { lastName: '鈴木', firstName: '美咲' },
        { lastName: '高橋', firstName: '健一' }, { lastName: '伊藤', firstName: '麻衣' },
        { lastName: '渡辺', firstName: '翔太' }, { lastName: '小林', firstName: '直子' },
    ]
    const menuIds = ['enzyme-set', 'yomogi-set']
    const statuses = ['confirmed', 'confirmed', 'confirmed', 'pending', 'cancelled', 'completed', 'completed']
    const today = new Date()
    for (let i = 0; i < 40; i++) {
        const daysAgo = Math.floor(Math.random() * 60) - 10
        const date = new Date(today)
        date.setDate(date.getDate() + daysAgo)
        if (date.getDay() === 0) date.setDate(date.getDate() + 1)
        const name = names[Math.floor(Math.random() * names.length)]
        const hour = 9 + Math.floor(Math.random() * 10)
        const menuId = menuIds[Math.floor(Math.random() * menuIds.length)]
        const menu = DEMO_MENUS.find(m => m.id === menuId)
        const guests = Math.random() > 0.7 ? 2 : 1
        const optionIds = []
        if (Math.random() > 0.6) optionIds.push('juice')
        if (Math.random() > 0.7) optionIds.push('nuka-pack')
        if (menuId.startsWith('enzyme') && Math.random() > 0.5) optionIds.push('massage-chair')
        const massageDuration1 = optionIds.includes('massage-chair') ? 20 : 0
        const massageDuration2 = optionIds.includes('massage-chair') && guests === 2 ? 20 : 0
        let totalPrice = (menu?.price || 0) * guests
        optionIds.forEach(oid => {
            const opt = DEMO_OPTIONS.find(o => o.id === oid)
            if (opt) totalPrice += opt.price * guests
        })
        const resourcePlan = buildResourceUsages({
            date: date.toISOString().split('T')[0],
            bathStartTime: `${String(hour).padStart(2, '0')}:00`,
            guests,
            menu,
            menus: DEMO_MENUS,
            options: DEMO_OPTIONS.filter(o => optionIds.includes(o.id)),
            massageDuration1,
            massageDuration2,
        })
        // 顧客リンク: 名前から対応する DEMO_CUSTOMERS を探す（一部は未リンク）
        const custMatch = DEMO_CUSTOMERS.find(c => c.lastName === name.lastName && c.firstName === name.firstName)
        const customerId = (i % 7 === 0) ? null : (custMatch?.id || null) // 7件に1件は未リンク
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        // 過去の予約は completed にする場合がある（未来の予約は completed にしない）
        const finalStatus = (status === 'completed' && daysAgo < 0) ? 'confirmed' : status

        reservations.push({
            id: `RES-DEMO${String(i).padStart(3, '0')}`,
            lastName: name.lastName, firstName: name.firstName,
            phone: '090-1234-' + String(1000 + i),
            email: `${name.lastName.toLowerCase()}@example.com`,
            menuId, date: date.toISOString().split('T')[0],
            time: `${String(hour).padStart(2, '0')}:00`,
            endTime: resourcePlan.bathEndTime,
            bathStartTime: resourcePlan.bathStartTime,
            bathEndTime: resourcePlan.bathEndTime,
            arrivalTime: resourcePlan.arrivalTime,
            totalDuration: resourcePlan.totalDuration,
            mainDuration: resourcePlan.mainDuration,
            resourceUsages: resourcePlan.resourceUsages,
            guests, options: optionIds, notes: '',
            massageDuration1,
            massageDuration2,
            status: finalStatus,
            customerId,
            totalPrice,
            createdAt: new Date(date.getTime() - 86400000 * 2).toISOString(),
            updatedAt: new Date(date.getTime() - 86400000 * 2).toISOString()
        })
    }
    return reservations.sort((a, b) => b.date.localeCompare(a.date))
})()
