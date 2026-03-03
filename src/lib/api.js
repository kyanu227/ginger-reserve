/**
 * GAS API クライアント
 * 
 * GAS_API_URL を .env の VITE_GAS_API_URL に設定してください。
 * デモモードではローカルデータを使用します。
 */

const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || ''
export { GAS_API_URL }
const IS_DEMO = !GAS_API_URL

// ===== デモ用データ（GAS未接続時に使用） =====
const DEMO_MENUS = [
    { id: 'enzyme-first', name: '酵素風呂', category: 'main', price: 3900, duration: 20, description: '基本の酵素風呂コース', icon: '🌿', active: true },
    { id: 'yomogi', name: 'よもぎ蒸し', category: 'main', price: 3900, duration: 30, description: 'よもぎ蒸しでリラックス。', icon: '🌱', active: true },
]

const DEMO_OPTIONS = [
    { id: 'massage-chair', name: 'マッサージチェア', price: 0, description: '酵素風呂の入浴前にご利用いただけます（20〜30分）', icon: '💆', constraint: 'enzyme-before', active: true },
    { id: 'juice', name: 'ジュース', price: 300, description: '新鮮なジュースをお楽しみください', icon: '🥤', constraint: '', active: true },
    { id: 'nuka-pack', name: '米糠パック', price: 500, description: 'お肌に優しい米糠パック', icon: '🧴', constraint: '', active: true },
]

// デモ用予約枠の生成
function generateDemoSlots(month) {
    const slots = []
    const [year, mon] = month ? month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
    const daysInMonth = new Date(year, mon, 0).getDate()

    for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const dayOfWeek = new Date(year, mon - 1, d).getDay()

        // Skip Sundays and past dates
        if (dayOfWeek === 0) continue
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (new Date(date) < today) continue

        // Open some demo slots
        for (let h = 9; h < 19; h++) {
            if (Math.random() > 0.4) {
                const booked = Math.random() > 0.7 ? 1 : 0
                slots.push({
                    date,
                    time: `${String(h).padStart(2, '0')}:00`,
                    capacity: 2,
                    booked,
                    open: true,
                    massageChairBooked: booked > 0 && Math.random() > 0.5
                })
            }
        }
    }
    return slots
}

// デモ用予約データ
const DEMO_RESERVATIONS = (() => {
    const reservations = []
    const names = [
        { lastName: '山田', firstName: '太郎' },
        { lastName: '佐藤', firstName: '花子' },
        { lastName: '田中', firstName: '一郎' },
        { lastName: '鈴木', firstName: '美咲' },
        { lastName: '高橋', firstName: '健一' },
        { lastName: '伊藤', firstName: '麻衣' },
        { lastName: '渡辺', firstName: '翔太' },
        { lastName: '小林', firstName: '直子' },
    ]
    const menuIds = ['enzyme-first', 'yomogi']
    const statuses = ['confirmed', 'confirmed', 'confirmed', 'confirmed', 'pending', 'cancelled']

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

        let totalPrice = (menu?.price || 0) * guests
        optionIds.forEach(oid => {
            const opt = DEMO_OPTIONS.find(o => o.id === oid)
            if (opt) totalPrice += opt.price * guests
        })

        reservations.push({
            id: `RES-DEMO${String(i).padStart(3, '0')}`,
            lastName: name.lastName,
            firstName: name.firstName,
            phone: '090-1234-' + String(1000 + i),
            email: `${name.lastName.toLowerCase()}@example.com`,
            menuId,
            date: date.toISOString().split('T')[0],
            time: `${String(hour).padStart(2, '0')}:00`,
            guests,
            options: optionIds,
            notes: '',
            status: statuses[Math.floor(Math.random() * statuses.length)],
            totalPrice,
            createdAt: new Date(date.getTime() - 86400000 * 2).toISOString(),
            updatedAt: new Date(date.getTime() - 86400000 * 2).toISOString()
        })
    }
    return reservations.sort((a, b) => b.date.localeCompare(a.date))
})()

// ===== API 関数 =====
async function fetchFromGAS(action, params = {}) {
    if (IS_DEMO) return null

    const url = new URL(GAS_API_URL)
    url.searchParams.set('action', action)
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v)
    })

    try {
        const res = await fetch(url.toString(), { redirect: 'follow' })
        return await res.json()
    } catch (err) {
        console.error('GAS GET error:', err)
        return null
    }
}

async function postToGAS(action, data = {}) {
    if (IS_DEMO) return null

    try {
        const res = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data }),
            redirect: 'follow'
        })
        return await res.json()
    } catch (err) {
        console.error('GAS POST error:', err)
        return { error: err.message }
    }
}

// ===== 公開API =====
export async function getInitData(month) {
    if (IS_DEMO) {
        return {
            menus: DEMO_MENUS,
            options: DEMO_OPTIONS,
            slotsResult: { slots: generateDemoSlots(month) },
            settings: {
                repeaterMenuName: '酵素風呂 (2回目以降)',
                repeaterDiscountAmount: 2900,
                repeaterOptionName: '自前酵素着なし（レンタル）',
                repeaterOptionPrice: 1000,
                '営業開始': '09:00',
                '営業終了': '21:00',
            }
        }
    }
    const data = await fetchFromGAS('getInitData', { month })
    if (!data) return { menus: DEMO_MENUS, options: DEMO_OPTIONS, slotsResult: { slots: generateDemoSlots(month) } }

    // Format times explicitly to avoid the 1899-12-30 bug
    if (data.slotsResult && data.slotsResult.slots) {
        data.slotsResult.slots = data.slotsResult.slots.map(s => ({
            ...s,
            time: formatTimeValue(s.time)
        }))
    }
    return data
}

export async function getMenus() {
    if (IS_DEMO) return DEMO_MENUS
    const data = await fetchFromGAS('getMenus')
    return data?.menus || DEMO_MENUS
}

export async function getOptions() {
    if (IS_DEMO) return DEMO_OPTIONS
    const data = await fetchFromGAS('getOptions')
    return data?.options || DEMO_OPTIONS
}

// 時間値を安全にフォーマット（GASが1899-12-30T...形式で返す場合の対策）
function formatTimeValue(val) {
    if (!val) return ''
    const str = String(val)
    // ISO形式 (1899-12-30T...Zなど) → HH:mm に変換
    if (str.includes('1899') || str.includes('T')) {
        try {
            const d = new Date(str)
            if (!isNaN(d.getTime())) {
                // If it's a 'Z' (UTC) string without actual time intent, or strictly JST, getHours parses the local equivalent.
                // But GAS typically returns naive datetime strings for spreadsheet times. 
                // A safer bet when extracting HH:mm from a purely localized string representation is substring.
                if (str.includes('T')) {
                    const timePart = str.split('T')[1].substring(0, 5) // "09:00"
                    if (timePart && timePart.includes(':')) return timePart
                }
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            }
        } catch (e) { /* fall through */ }
    }
    // 既にHH:mm形式ならそのまま
    return str
}

export async function getSlots(month) {
    if (IS_DEMO) return generateDemoSlots(month)
    const data = await fetchFromGAS('getSlots', { month })
    return (data?.slots || []).map(s => ({ ...s, time: formatTimeValue(s.time) }))
}

export async function getReservations(status, date) {
    if (IS_DEMO) {
        let res = [...DEMO_RESERVATIONS]
        if (status && status !== 'all') res = res.filter(r => r.status === status)
        if (date) res = res.filter(r => r.date === date)
        return res
    }
    const data = await fetchFromGAS('getReservations', { status, date })
    return (data?.reservations || []).map(r => ({ ...r, time: formatTimeValue(r.time) }))
}

export async function createReservation(reservation) {
    if (IS_DEMO) {
        const id = 'RES-DEMO' + Date.now().toString(36).toUpperCase()
        const menu = DEMO_MENUS.find(m => m.id === reservation.menuId)
        let totalPrice = (menu?.price || 0) * (reservation.guests || 1)
        if (reservation.options) {
            reservation.options.forEach(oid => {
                const opt = DEMO_OPTIONS.find(o => o.id === oid)
                if (opt) totalPrice += opt.price * (reservation.guests || 1)
            })
        }
        return { success: true, id, totalPrice }
    }
    return await postToGAS('createReservation', { reservation })
}

export async function updateReservation(id, updates) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('updateReservation', { id, updates })
}

export async function cancelReservation(id) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('cancelReservation', { id })
}

export async function updateSlots(slots) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('updateSlots', { slots })
}

export async function updateMenus(menus) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('updateMenu', { menus })
}

export async function updateOptionsData(options) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('updateOptions', { options })
}

export async function getSystemSettings() {
    if (IS_DEMO) return {
        repeaterMenuName: '酵素風呂 (2回目以降)',
        repeaterDiscountAmount: 2900,
        repeaterOptionName: '自前酵素着なし（レンタル）',
        repeaterOptionPrice: 1000,
        '営業開始': '09:00',
        '営業終了': '21:00',
    }
    const data = await fetchFromGAS('getSystemSettings')
    return data?.settings || {}
}

export async function updateSystemSettings(settings) {
    if (IS_DEMO) return { success: true }
    return await postToGAS('updateSystemSettings', { settings })
}

export async function getStats() {
    if (IS_DEMO) {
        // Generate demo stats
        const confirmed = DEMO_RESERVATIONS.filter(r => r.status !== 'cancelled')
        const totalRevenue = confirmed.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
        const cancelled = DEMO_RESERVATIONS.filter(r => r.status === 'cancelled')

        const monthly = {}
        confirmed.forEach(r => {
            const month = r.date.substring(0, 7)
            if (!monthly[month]) monthly[month] = { count: 0, revenue: 0 }
            monthly[month].count++
            monthly[month].revenue += r.totalPrice || 0
        })

        const courseStats = {}
        confirmed.forEach(r => {
            const menu = DEMO_MENUS.find(m => m.id === r.menuId)
            const name = menu ? menu.name : r.menuId
            if (!courseStats[name]) courseStats[name] = 0
            courseStats[name]++
        })

        const hourly = {}
        for (let h = 9; h < 19; h++) hourly[h + ':00'] = 0
        confirmed.forEach(r => {
            const hour = parseInt(r.time.split(':')[0])
            hourly[hour + ':00'] = (hourly[hour + ':00'] || 0) + 1
        })

        const dayOfWeek = { '月': 0, '火': 0, '水': 0, '木': 0, '金': 0, '土': 0, '日': 0 }
        const dayNames = ['日', '月', '火', '水', '木', '金', '土']
        confirmed.forEach(r => {
            const day = dayNames[new Date(r.date).getDay()]
            dayOfWeek[day]++
        })

        const emailCount = {}
        confirmed.forEach(r => {
            if (!emailCount[r.email]) emailCount[r.email] = 0
            emailCount[r.email]++
        })

        return {
            monthly: Object.entries(monthly).map(([month, d]) => ({ month, ...d })).sort((a, b) => a.month.localeCompare(b.month)),
            courseStats: Object.entries(courseStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            hourly: Object.entries(hourly).map(([hour, count]) => ({ hour, count })),
            dayOfWeek: Object.entries(dayOfWeek).map(([day, count]) => ({ day, count })),
            newCustomers: Object.values(emailCount).filter(c => c === 1).length,
            repeatCustomers: Object.values(emailCount).filter(c => c > 1).length,
            totalRevenue,
            confirmed: confirmed.length,
            cancelled: cancelled.length,
            cancelRate: DEMO_RESERVATIONS.length > 0 ? ((cancelled.length / DEMO_RESERVATIONS.length) * 100).toFixed(1) : '0'
        }
    }
    return await fetchFromGAS('getStats')
}

export async function addProduct(product) {
    if (IS_DEMO) return { success: true, id: 'PRD-DEMO' + Date.now().toString(36) }
    return await postToGAS('addProduct', { product })
}

export async function checkRepeaterEmail(email) {
    if (IS_DEMO) {
        // Mock logic: if email is tanaka@example.com (or in demo names), return true
        const isRepeater = DEMO_RESERVATIONS.some(r => r.email === email && r.status !== 'cancelled')
        return { isRepeater }
    }
    return await postToGAS('checkRepeaterEmail', { email })
}

export async function getProducts() {
    if (IS_DEMO) return []
    const data = await fetchFromGAS('getProducts')
    return data?.products || []
}

// ===== ユーティリティ =====
export function formatPrice(price) {
    return `¥${Number(price).toLocaleString()}`
}

export function formatDate(dateStr) {
    const d = new Date(dateStr)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export function getStatusLabel(status) {
    const map = { confirmed: '確定', pending: '保留中', cancelled: 'キャンセル' }
    return map[status] || status
}

export function getStatusColor(status) {
    const map = { confirmed: '#4a7c59', pending: '#c4a35a', cancelled: '#c0392b' }
    return map[status] || '#666'
}
