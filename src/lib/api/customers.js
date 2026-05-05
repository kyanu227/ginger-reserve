/**
 * 顧客管理（名簿連携）
 * - 自動ID（将来のログイン機能に対応）
 * - 予約との自動/手動リンク
 * - 来店回数トラッキング
 */

import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, increment
} from 'firebase/firestore'
import { db } from '../firebase'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { IS_DEMO, DEMO_CUSTOMERS, DEMO_RESERVATIONS } from './demo.js'
import { normalizePhone } from './formatters.js'

const CACHE_KEY = 'customers'
const CACHE_TTL = 2 * 60 * 1000 // 2分

// ============ READ ============

/**
 * 全顧客一覧を取得（管理画面用）
 * @param {{ search?: string }} opts
 */
export async function getCustomers(opts = {}) {
    if (IS_DEMO) {
        let list = [...DEMO_CUSTOMERS]
        if (opts.search) {
            const q = opts.search.toLowerCase()
            list = list.filter(c =>
                (c.lastName + c.firstName).includes(q) ||
                (c.lastNameKana + c.firstNameKana).includes(q) ||
                (c.phoneNorm || '').includes(q.replace(/[^0-9]/g, '')) ||
                (c.email || '').toLowerCase().includes(q)
            )
        }
        return list
    }

    const hit = cacheGet(CACHE_KEY)
    if (hit && !opts.search) return hit

    const snap = await getDocs(collection(db, 'customers'))
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''))
    cacheSet(CACHE_KEY, list, CACHE_TTL)

    if (opts.search) {
        const q = opts.search.toLowerCase()
        list = list.filter(c =>
            ((c.lastName || '') + (c.firstName || '')).includes(q) ||
            ((c.lastNameKana || '') + (c.firstNameKana || '')).includes(q) ||
            (c.phoneNorm || '').includes(q.replace(/[^0-9]/g, '')) ||
            (c.email || '').toLowerCase().includes(q)
        )
    }
    return list
}

/**
 * 単一顧客を取得
 */
export async function getCustomer(customerId) {
    if (IS_DEMO) return DEMO_CUSTOMERS.find(c => c.id === customerId) || null
    const snap = await getDoc(doc(db, 'customers', customerId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * 顧客の紐付き予約履歴を取得
 */
export async function getCustomerReservations(customerId) {
    if (IS_DEMO) {
        return DEMO_RESERVATIONS
            .filter(r => r.customerId === customerId)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    }
    const snap = await getDocs(query(
        collection(db, 'reservations'),
        where('customerId', '==', customerId)
    ))
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

// ============ SEARCH ============

/**
 * 顧客を検索（手動リンク時のオートコンプリート用）
 * @param {string} searchQuery - 検索キーワード
 * @returns {Promise<Array>} 上位20件
 */
export async function searchCustomers(searchQuery) {
    if (!searchQuery || searchQuery.trim().length === 0) return []
    const all = await getCustomers()
    const q = searchQuery.toLowerCase()
    return all.filter(c =>
        ((c.lastName || '') + (c.firstName || '')).includes(q) ||
        ((c.lastNameKana || '') + (c.firstNameKana || '')).includes(q) ||
        (c.phoneNorm || '').includes(q.replace(/[^0-9]/g, '')) ||
        (c.email || '').toLowerCase().includes(q)
    ).slice(0, 20)
}

// ============ WRITE ============

/**
 * 新規顧客を作成
 */
export async function createCustomer(data) {
    if (IS_DEMO) {
        const id = 'cust-demo-' + Date.now().toString(36)
        return { success: true, id }
    }
    try {
        const now = new Date().toISOString()
        const custData = {
            lastName: data.lastName || '',
            firstName: data.firstName || '',
            lastNameKana: data.lastNameKana || '',
            firstNameKana: data.firstNameKana || '',
            phone: data.phone || '',
            phoneNorm: normalizePhone(data.phone || ''),
            email: (data.email || '').trim().toLowerCase(),
            visitCount: data.visitCount || 0,
            lastVisitDate: data.lastVisitDate || '',
            memo: data.memo || '',
            createdAt: now,
            lastUpdated: now
        }
        const ref = await addDoc(collection(db, 'customers'), custData)
        cacheDel(CACHE_KEY)
        return { success: true, id: ref.id }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

/**
 * 顧客情報を更新（管理画面から）
 */
export async function updateCustomer(customerId, updates) {
    if (IS_DEMO) return { success: true }
    try {
        await updateDoc(doc(db, 'customers', customerId), {
            ...updates,
            lastUpdated: new Date().toISOString()
        })
        cacheDel(CACHE_KEY)
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

// ============ LINKING ============

/**
 * 予約を顧客にリンク
 */
export async function linkReservation(reservationId, customerId) {
    if (IS_DEMO) return { success: true }
    try {
        await updateDoc(doc(db, 'reservations', reservationId), {
            customerId,
            updatedAt: new Date().toISOString()
        })
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

/**
 * 予約のリンクを解除
 */
export async function unlinkReservation(reservationId) {
    if (IS_DEMO) return { success: true }
    try {
        await updateDoc(doc(db, 'reservations', reservationId), {
            customerId: null,
            updatedAt: new Date().toISOString()
        })
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

/**
 * 自動リンク: (lastName + phoneNorm) OR (lastName + email) でマッチする顧客を探す
 * @returns {Promise<{id: string, visitCount: number}|null>}
 */
export async function findMatchingCustomer({ lastName, firstName, phone, email }) {
    if (IS_DEMO) {
        const phoneNorm = normalizePhone(phone || '')
        const emailLower = (email || '').trim().toLowerCase()
        const last = (lastName || '').trim()
        for (const c of DEMO_CUSTOMERS) {
            // 電話+姓一致
            if (phoneNorm && c.phoneNorm === phoneNorm && c.lastName === last) {
                return { id: c.id, visitCount: c.visitCount || 0 }
            }
            // メール+姓一致
            if (emailLower && c.email === emailLower && c.lastName === last) {
                return { id: c.id, visitCount: c.visitCount || 0 }
            }
        }
        return null
    }

    const last = (lastName || '').trim()
    const phoneNorm = normalizePhone(phone || '')
    const emailLower = (email || '').trim().toLowerCase()

    // 1) 電話番号+姓で検索
    if (phoneNorm && last) {
        const snap = await getDocs(query(
            collection(db, 'customers'),
            where('phoneNorm', '==', phoneNorm)
        ))
        for (const d of snap.docs) {
            const cust = d.data()
            if (cust.lastName === last) {
                return { id: d.id, visitCount: cust.visitCount || 0 }
            }
        }
    }

    // 2) メール+姓で検索
    if (emailLower && last) {
        const snap = await getDocs(query(
            collection(db, 'customers'),
            where('email', '==', emailLower)
        ))
        for (const d of snap.docs) {
            const cust = d.data()
            if (cust.lastName === last) {
                return { id: d.id, visitCount: cust.visitCount || 0 }
            }
        }
    }

    return null
}

/**
 * visitCount をインクリメント（completed ステータス遷移時に呼ぶ）
 */
export async function incrementVisitCount(customerId, visitDate) {
    if (IS_DEMO) return { success: true }
    try {
        const updates = {
            visitCount: increment(1),
            lastUpdated: new Date().toISOString()
        }
        if (visitDate) updates.lastVisitDate = visitDate
        await updateDoc(doc(db, 'customers', customerId), updates)
        cacheDel(CACHE_KEY)
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

// ============ DUPLICATE DETECTION ============

/**
 * 重複候補をグループ化して返す（クライアントサイド処理）
 * 判定: phoneNorm一致 / email一致 / lastName+firstName完全一致
 * @param {Array} customers - 全顧客リスト
 * @returns {Array<Array>} 重複グループの配列（各グループは2件以上）
 */
export function findDuplicates(customers) {
    if (!customers || customers.length < 2) return []

    // Union-Find
    const parent = {}
    function find(x) {
        if (!(x in parent)) parent[x] = x
        if (parent[x] !== x) parent[x] = find(parent[x])
        return parent[x]
    }
    function union(a, b) {
        const ra = find(a), rb = find(b)
        if (ra !== rb) parent[ra] = rb
    }

    const idList = customers.map(c => c.id)
    idList.forEach(id => { parent[id] = id })

    // phoneNorm でグループ化
    const phoneMap = {}
    for (const c of customers) {
        const p = c.phoneNorm || ''
        if (!p) continue
        if (phoneMap[p]) { union(phoneMap[p], c.id) } else { phoneMap[p] = c.id }
    }

    // email でグループ化
    const emailMap = {}
    for (const c of customers) {
        const e = (c.email || '').trim().toLowerCase()
        if (!e) continue
        if (emailMap[e]) { union(emailMap[e], c.id) } else { emailMap[e] = c.id }
    }

    // lastName+firstName でグループ化
    const nameMap = {}
    for (const c of customers) {
        const last = (c.lastName || '').trim()
        const first = (c.firstName || '').trim()
        if (!last && !first) continue
        const key = last + '\0' + first
        if (nameMap[key]) { union(nameMap[key], c.id) } else { nameMap[key] = c.id }
    }

    // グループ収集
    const groups = {}
    const custMap = {}
    for (const c of customers) { custMap[c.id] = c }
    for (const id of idList) {
        const root = find(id)
        if (!groups[root]) groups[root] = []
        groups[root].push(custMap[id])
    }

    return Object.values(groups).filter(g => g.length >= 2)
}

// ============ MERGE ============

/**
 * 顧客を統合: secondary の予約を primary に付け替え、secondary を削除
 * @param {string} primaryId - 残す顧客の ID
 * @param {string[]} secondaryIds - 統合される顧客の ID 配列
 * @param {{ keepSubContacts?: boolean }} opts - サブ連絡先として保持するか
 */
export async function mergeCustomers(primaryId, secondaryIds, opts = {}) {
    if (IS_DEMO) return { success: true, mergedCount: secondaryIds.length }

    const keepSub = opts.keepSubContacts !== false // デフォルト true

    try {
        // 1. primary と secondary の顧客データを取得
        const primarySnap = await getDoc(doc(db, 'customers', primaryId))
        if (!primarySnap.exists()) return { success: false, error: 'プライマリ顧客が見つかりません' }
        const primary = primarySnap.data()

        const secondaries = []
        for (const sid of secondaryIds) {
            const snap = await getDoc(doc(db, 'customers', sid))
            if (snap.exists()) secondaries.push({ id: sid, ...snap.data() })
        }

        // 2. secondary の全予約を primary に付け替え
        for (const sec of secondaries) {
            const resSnap = await getDocs(query(
                collection(db, 'reservations'),
                where('customerId', '==', sec.id)
            ))
            for (const d of resSnap.docs) {
                await updateDoc(doc(db, 'reservations', d.id), {
                    customerId: primaryId,
                    updatedAt: new Date().toISOString()
                })
            }
        }

        // 3. primary を更新
        const totalVisit = (primary.visitCount || 0) + secondaries.reduce((s, c) => s + (c.visitCount || 0), 0)
        const allDates = [primary.lastVisitDate || '', ...secondaries.map(c => c.lastVisitDate || '')].filter(Boolean)
        const latestVisit = allDates.length ? allDates.sort().pop() : ''

        // メモ結合
        const memos = [primary.memo || '', ...secondaries.map(c => c.memo || '')].filter(Boolean)
        const mergedMemo = [...new Set(memos)].join('\n')

        // 連絡先補完 + サブ連絡先
        const updates = {
            visitCount: totalVisit,
            lastVisitDate: latestVisit,
            memo: mergedMemo,
            lastUpdated: new Date().toISOString()
        }

        // primary が空なら secondary から補完
        if (!primary.phone && !primary.phoneNorm) {
            const donor = secondaries.find(c => c.phone || c.phoneNorm)
            if (donor) {
                updates.phone = donor.phone || ''
                updates.phoneNorm = donor.phoneNorm || normalizePhone(donor.phone || '')
            }
        }
        if (!(primary.email || '').trim()) {
            const donor = secondaries.find(c => (c.email || '').trim())
            if (donor) updates.email = (donor.email || '').trim().toLowerCase()
        }

        // サブ連絡先として保持
        if (keepSub) {
            const primaryPhone = primary.phoneNorm || normalizePhone(primary.phone || '')
            const primaryEmail = (primary.email || '').trim().toLowerCase()
            const altPhones = secondaries.map(c => c.phone || '').filter(p => {
                const norm = normalizePhone(p)
                return norm && norm !== primaryPhone && norm !== normalizePhone(updates.phone || '')
            })
            const altEmails = secondaries.map(c => (c.email || '').trim().toLowerCase()).filter(e =>
                e && e !== primaryEmail && e !== (updates.email || '')
            )
            if (altPhones.length > 0) updates.phone2 = altPhones[0]
            if (altEmails.length > 0) updates.email2 = altEmails[0]
        }

        await updateDoc(doc(db, 'customers', primaryId), updates)

        // 4. secondary を削除
        for (const sec of secondaries) {
            await deleteDoc(doc(db, 'customers', sec.id))
        }

        cacheDel(CACHE_KEY)
        return { success: true, mergedCount: secondaries.length }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

// ============ MIGRATION ============

/**
 * 旧 customers（email=docID）→ 新方式（自動ID）へのマイグレーション
 * AdminSettings から1回実行する想定
 */
export async function migrateCustomers() {
    if (IS_DEMO) return { success: true, migrated: 0, linked: 0 }
    try {
        // 1. 旧 customers を全件読み取り
        const custSnap = await getDocs(collection(db, 'customers'))
        const oldDocs = custSnap.docs

        // メールアドレスをキーにしたドキュメントのみ対象（@ を含む）
        const emailKeyedDocs = oldDocs.filter(d => d.id.includes('@'))
        if (emailKeyedDocs.length === 0) {
            return { success: true, migrated: 0, linked: 0, message: 'マイグレーション不要（旧形式のデータなし）' }
        }

        const now = new Date().toISOString()
        const emailToNewId = {} // old email → new auto ID

        // 2. 新ドキュメントを作成
        for (const d of emailKeyedDocs) {
            const data = d.data()
            const newData = {
                lastName: data.lastName || '',
                firstName: data.firstName || '',
                lastNameKana: '',
                firstNameKana: '',
                phone: '',
                phoneNorm: data.phoneNorm || '',
                email: data.email || d.id,
                visitCount: data.visitCount || 0,
                lastVisitDate: '',
                memo: '',
                createdAt: data.lastUpdated || now,
                lastUpdated: data.lastUpdated || now
            }
            const ref = await addDoc(collection(db, 'customers'), newData)
            emailToNewId[d.id] = ref.id
        }

        // 3. 既存予約に customerId をリンク
        let linked = 0
        const resSnap = await getDocs(collection(db, 'reservations'))
        for (const d of resSnap.docs) {
            const res = d.data()
            if (res.customerId) continue // 既にリンク済み
            const emailNorm = (res.email || '').trim().toLowerCase()
            const newId = emailToNewId[emailNorm]
            if (newId) {
                await updateDoc(doc(db, 'reservations', d.id), { customerId: newId })
                linked++
            }
        }

        // 4. 旧ドキュメントを削除
        for (const d of emailKeyedDocs) {
            await deleteDoc(doc(db, 'customers', d.id))
        }

        cacheDel(CACHE_KEY)
        return { success: true, migrated: emailKeyedDocs.length, linked, message: `${emailKeyedDocs.length}件の顧客を移行、${linked}件の予約をリンクしました` }
    } catch (err) {
        return { success: false, error: err.message }
    }
}
