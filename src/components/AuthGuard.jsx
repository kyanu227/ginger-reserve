/**
 * 管理画面の認証ガード
 * 未ログイン or staff 未登録 → AdminLogin を表示
 */
import { useRole } from '../lib/RoleContext'
import AdminLogin from '../pages/AdminLogin'

export default function AuthGuard({ children }) {
    const { user, role, loading } = useRole()

    if (loading) {
        return (
            <div className="admin-layout">
                <main className="admin-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="loading-spinner"></div>
                </main>
            </div>
        )
    }

    if (!user || !role) return <AdminLogin />

    return children
}
