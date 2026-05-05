/**
 * RoleContext — Firebase Auth + Firestore staff コレクションに基づくロール管理
 *
 * staff/{email} ドキュメント構造:
 *   { email, name, role: 'admin'|'staff', active: true, createdAt }
 *
 * 初回ログイン時: ADMIN_EMAILS に含まれるメールアドレスは自動で admin として登録される
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { ADMIN_EMAILS } from './config'

const RoleContext = createContext({ user: null, role: null, loading: true })

export function RoleProvider({ children }) {
    const [state, setState] = useState({ user: null, role: null, loading: true })

    useEffect(() => {
        return onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setState({ user: null, role: null, loading: false })
                return
            }
            try {
                const staffRef = doc(db, 'staff', user.email.toLowerCase())
                const snap = await getDoc(staffRef)

                if (snap.exists() && snap.data().active !== false) {
                    // 既存スタッフ
                    setState({ user, role: snap.data().role, loading: false })
                } else if (ADMIN_EMAILS.includes(user.email)) {
                    // config.js に記載の初期管理者 → 自動で admin として登録
                    const staffData = {
                        email: user.email.toLowerCase(),
                        name: user.displayName || user.email,
                        role: 'admin',
                        active: true,
                        createdAt: new Date().toISOString()
                    }
                    await setDoc(staffRef, staffData)
                    setState({ user, role: 'admin', loading: false })
                } else {
                    // staff コレクションに存在しない → アクセス不可
                    setState({ user, role: null, loading: false })
                }
            } catch (e) {
                console.error('[RoleContext]', e)
                setState({ user, role: null, loading: false })
            }
        })
    }, [])

    return <RoleContext.Provider value={state}>{children}</RoleContext.Provider>
}

export const useRole = () => useContext(RoleContext)
