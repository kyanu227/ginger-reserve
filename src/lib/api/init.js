/**
 * Firestore 初期化（初回のみメニュー/オプション/設定をシード）
 * getInitData: 初回データ一括取得
 */

import {
    collection, doc, getDocs, setDoc, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'
import { cacheSet } from './cache.js'
import { IS_DEMO, DEMO_MENUS, DEMO_OPTIONS, DEMO_RESOURCES, DEMO_SETTINGS, generateDemoRanges, expandRangesToSlots } from './demo.js'
import { getMenus, getOptions } from './menus.js'
import { getResources } from './resources.js'
import { getRanges } from './slots.js'
import { getSystemSettings } from './settings.js'

// ===== Firestore 初期化（初回のみメニュー/オプション/設定をシード） =====
// 読んだメニューをキャッシュに乗せることで、直後の getMenus() の2重読み取りを防ぐ
let _initChecked = false
export async function maybeInitializeData() {
    if (_initChecked) return
    _initChecked = true
    try {
        const menusSnap = await getDocs(collection(db, 'menus'))
        if (menusSnap.empty) {
            console.log('[api] Seeding initial Firestore data...')
            const batch = writeBatch(db)
            DEMO_MENUS.forEach(m => batch.set(doc(db, 'menus', m.id), m))
            DEMO_OPTIONS.forEach(o => batch.set(doc(db, 'options', o.id), o))
            DEMO_RESOURCES.forEach(r => batch.set(doc(db, 'resources', r.id), r))
            batch.set(doc(db, 'settings', 'main'), DEMO_SETTINGS)
            await batch.commit()
            cacheSet('menus', DEMO_MENUS)
            cacheSet('resources', DEMO_RESOURCES)
            console.log('[api] Seed complete.')
        } else {
            // 読んだ結果をキャッシュ → getMenus() の2回目読み取りをゼロに
            const menus = menusSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            cacheSet('menus', menus)
        }
    } catch (e) {
        console.error('[api] Failed to initialize data:', e)
    }
}

// Firestoreバッチ書き込み（500件制限を自動分割）
export async function batchWrite(operations) {
    const BATCH_SIZE = 499
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const chunk = operations.slice(i, i + BATCH_SIZE)
        const batch = writeBatch(db)
        chunk.forEach(op => {
            if (op.type === 'set') batch.set(op.ref, op.data, op.options || {})
            else if (op.type === 'update') batch.update(op.ref, op.data)
            else if (op.type === 'delete') batch.delete(op.ref)
        })
        await batch.commit()
    }
}

export async function getInitData(month) {
    if (IS_DEMO) {
        const demoRanges = generateDemoRanges(month)
        return {
            menus: DEMO_MENUS,
            options: DEMO_OPTIONS,
            resources: DEMO_RESOURCES,
            slotsResult: { slots: expandRangesToSlots(demoRanges), ranges: demoRanges },
            settings: DEMO_SETTINGS
        }
    }
    await maybeInitializeData()
    // getRanges はキャッシュ対応済み。expandRangesToSlots はメモリのみで IO なし
    const [menus, options, resources, ranges, settings] = await Promise.all([
        getMenus(),
        getOptions(),
        getResources(),
        getRanges(month),
        getSystemSettings()
    ])
    return { menus, options, resources, slotsResult: { slots: expandRangesToSlots(ranges), ranges }, settings }
}
