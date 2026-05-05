/**
 * システム設定管理
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, DEMO_SETTINGS } from './demo.js'

export async function getSystemSettings() {
    if (IS_DEMO) return DEMO_SETTINGS
    const hit = cacheGet('settings')
    if (hit) return hit
    const snap = await getDoc(doc(db, 'settings', 'main'))
    const settings = snap.exists() ? snap.data() : DEMO_SETTINGS
    cacheSet('settings', settings)
    return settings
}

export async function updateSystemSettings(settings) {
    if (IS_DEMO) return { success: true }
    try {
        await setDoc(doc(db, 'settings', 'main'), settings, { merge: true })
        cacheDel('settings') // キャッシュを無効化
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}
