/**
 * 設備リソース管理
 */

import { collection, doc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, DEMO_RESOURCES } from './demo.js'
import { batchWrite } from './init.js'

export async function getResources() {
    if (IS_DEMO) return DEMO_RESOURCES
    const hit = cacheGet('resources')
    if (hit) return hit
    const snap = await getDocs(collection(db, 'resources'))
    const resources = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    cacheSet('resources', resources)
    return resources
}

export async function updateResourcesData(resources) {
    if (IS_DEMO) return { success: true }
    try {
        const snap = await getDocs(collection(db, 'resources'))
        const newIds = new Set(resources.map(resource => resource.id))
        const ops = []
        snap.docs.forEach(d => {
            if (!newIds.has(d.id)) ops.push({ type: 'delete', ref: d.ref })
        })
        resources.forEach((resource, i) => {
            ops.push({
                type: 'set',
                ref: doc(db, 'resources', resource.id),
                data: { ...resource, order: i },
            })
        })
        await batchWrite(ops)
        cacheDel('resources')
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

