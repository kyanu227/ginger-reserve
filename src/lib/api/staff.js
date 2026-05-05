/**
 * スタッフ管理
 * ドキュメントID = email.toLowerCase()（1読み取りで引けるため）
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { IS_DEMO } from './demo.js'

export async function getStaff() {
    if (IS_DEMO) return []
    const snap = await getDocs(collection(db, 'staff'))
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

export async function addStaff({ email, name, role }) {
    if (IS_DEMO) return { success: true }
    const id = email.trim().toLowerCase()
    try {
        const existing = await getDoc(doc(db, 'staff', id))
        if (existing.exists()) return { success: false, error: 'このメールアドレスは既に登録されています' }
        await setDoc(doc(db, 'staff', id), {
            email: id,
            name: name.trim(),
            role,
            active: true,
            createdAt: new Date().toISOString()
        })
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

export async function updateStaff(email, updates) {
    if (IS_DEMO) return { success: true }
    try {
        await updateDoc(doc(db, 'staff', email.toLowerCase()), {
            ...updates,
            updatedAt: new Date().toISOString()
        })
        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
}
