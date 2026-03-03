import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import AdminLogin from '../pages/AdminLogin'
import { ADMIN_EMAILS } from '../lib/config'

export default function AuthGuard({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })
        return () => unsubscribe()
    }, [])

    if (loading) {
        return (
            <div className="admin-layout">
                <main className="admin-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="loading-spinner"></div>
                </main>
            </div>
        )
    }

    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        return <AdminLogin />
    }

    return children
}
