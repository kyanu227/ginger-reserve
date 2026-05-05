/**
 * メニュー・オプション管理
 */

import { collection, doc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, DEMO_MENUS, DEMO_OPTIONS } from './demo.js'
import { maybeInitializeData, batchWrite } from './init.js'

export async function getMenus() {
    if (IS_DEMO) return DEMO_MENUS
    const hit = cacheGet('menus')
    if (hit) return hit
    await maybeInitializeData()
    const hit2 = cacheGet('menus') // maybeInitializeData がキャッシュを埋めた場合
    if (hit2) return hit2
    const snap = await getDocs(collection(db, 'menus'))
    const menus = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    cacheSet('menus', menus)
    return menus
}

export async function getOptions() {
    if (IS_DEMO) return DEMO_OPTIONS
    const hit = cacheGet('options')
    if (hit) return hit
    const snap = await getDocs(collection(db, 'options'))
    const options = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    cacheSet('options', options)
    return options
}

export async function updateMenus(menus) {
    if (IS_DEMO) return { success: true }
    try {
        // 既存IDを取得して削除対象を特定
        const snap = await getDocs(collection(db, 'menus'))
        const newIds = new Set(menus.map(m => m.id))
        const ops = []
        snap.docs.forEach(d => {
            if (!newIds.has(d.id)) ops.push({ type: 'delete', ref: d.ref })
        })
        menus.forEach((menu, i) => {
            ops.push({
                type: 'set',
                ref: doc(db, 'menus', menu.id),
                data: { ...menu, order: i }
            })
        })
        await batchWrite(ops)
        cacheDel('menus') // キャッシュを無効化
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

export async function updateOptionsData(options) {
    if (IS_DEMO) return { success: true }
    try {
        const snap = await getDocs(collection(db, 'options'))
        const newIds = new Set(options.map(o => o.id))
        const ops = []
        snap.docs.forEach(d => {
            if (!newIds.has(d.id)) ops.push({ type: 'delete', ref: d.ref })
        })
        options.forEach((opt, i) => {
            ops.push({
                type: 'set',
                ref: doc(db, 'options', opt.id),
                data: { ...opt, order: i }
            })
        })
        await batchWrite(ops)
        cacheDel('options') // キャッシュを無効化
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}
