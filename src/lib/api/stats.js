/**
 * 統計データ取得
 */

import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { DAY_LABELS } from '../constants'
import { IS_DEMO, DEMO_MENUS, DEMO_RESERVATIONS } from './demo.js'
import { getMenus } from './menus.js'

export async function getStats() {
    if (IS_DEMO) {
        const confirmed = DEMO_RESERVATIONS.filter(r => r.status !== 'cancelled')
        const cancelled = DEMO_RESERVATIONS.filter(r => r.status === 'cancelled')
        const totalRevenue = confirmed.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
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
        const dayNames = DAY_LABELS
        confirmed.forEach(r => { dayOfWeek[dayNames[new Date(r.date).getDay()]]++ })
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
            totalRevenue, confirmed: confirmed.length, cancelled: cancelled.length,
            cancelRate: DEMO_RESERVATIONS.length > 0 ? ((cancelled.length / DEMO_RESERVATIONS.length) * 100).toFixed(1) : '0'
        }
    }

    // Firestore: 全予約を取得して集計
    const snap = await getDocs(collection(db, 'reservations'))
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const confirmed = all.filter(r => r.status !== 'cancelled')
    const cancelled = all.filter(r => r.status === 'cancelled')
    const totalRevenue = confirmed.reduce((sum, r) => sum + (r.totalPrice || 0), 0)

    const menus = await getMenus()
    const monthly = {}
    confirmed.forEach(r => {
        const month = r.date?.substring(0, 7)
        if (!month) return
        if (!monthly[month]) monthly[month] = { count: 0, revenue: 0 }
        monthly[month].count++
        monthly[month].revenue += r.totalPrice || 0
    })
    const courseStats = {}
    confirmed.forEach(r => {
        const menu = menus.find(m => m.id === r.menuId)
        const name = menu ? menu.name : r.menuId
        if (!courseStats[name]) courseStats[name] = 0
        courseStats[name]++
    })
    const hourly = {}
    for (let h = 9; h < 19; h++) hourly[h + ':00'] = 0
    confirmed.forEach(r => {
        if (!r.time) return
        const hour = parseInt(r.time.split(':')[0])
        if (!isNaN(hour)) hourly[hour + ':00'] = (hourly[hour + ':00'] || 0) + 1
    })
    const dayOfWeek = { '月': 0, '火': 0, '水': 0, '木': 0, '金': 0, '土': 0, '日': 0 }
    const dayNames = DAY_LABELS
    confirmed.forEach(r => {
        if (!r.date) return
        dayOfWeek[dayNames[new Date(r.date + 'T00:00:00').getDay()]]++
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
        totalRevenue, confirmed: confirmed.length, cancelled: cancelled.length,
        cancelRate: all.length > 0 ? ((cancelled.length / all.length) * 100).toFixed(1) : '0'
    }
}
