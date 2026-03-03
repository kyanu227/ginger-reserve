import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './lib/firebase'
import ReservationPage from './pages/ReservationPage'
import ReservationConfirm from './pages/ReservationConfirm'
import AdminDashboard from './pages/AdminDashboard'
import CalendarView from './pages/CalendarView'
import StatisticsView from './pages/StatisticsView'
import SlotManagement from './pages/SlotManagement'
import MenuManagement from './pages/MenuManagement'
import ReservationDetail from './pages/ReservationDetail'
import AuthGuard from './components/AuthGuard'
import CustomerLogin from './pages/CustomerLogin'
import CustomerRegister from './pages/CustomerRegister'
import AdminSettings from './pages/AdminSettings'
import { ADMIN_EMAILS } from './lib/config'

function App() {
    const location = useLocation()
    const isAdmin = location.pathname.startsWith('/admin')
    const [user, setUser] = useState(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u))
        return () => unsubscribe()
    }, [])

    const handleLogout = async () => {
        await signOut(auth)
        window.location.href = '/'
    }

    const isSuperAdmin = user && ADMIN_EMAILS.includes(user.email)

    const showHeader = !isAdmin

    return (
        <>
            {showHeader && (
                <header className="header">
                    <div className="header-inner">
                        <Link to="/" className="header-logo">🌿 酵素風呂</Link>
                        <nav className="header-nav">
                            <Link to="/" className={!isAdmin && location.pathname === '/' ? 'active' : ''}>予約する</Link>
                            {user ? (
                                <>
                                    {isSuperAdmin && (
                                        <Link to="/admin" className={isAdmin ? 'active' : ''}>管理画面</Link>
                                    )}
                                    <button onClick={handleLogout} className="header-logout-btn">
                                        ログアウト
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>ログイン/会員登録</Link>
                            )}
                        </nav>
                    </div>
                </header>
            )}

            <Routes>
                <Route path="/" element={<ReservationPage />} />
                <Route path="/login" element={<CustomerLogin />} />
                <Route path="/register" element={<CustomerRegister />} />
                <Route path="/confirm" element={<ReservationConfirm />} />
                <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
                <Route path="/admin/calendar" element={<AuthGuard><CalendarView /></AuthGuard>} />
                <Route path="/admin/stats" element={<AuthGuard><StatisticsView /></AuthGuard>} />
                <Route path="/admin/slots" element={<AuthGuard><SlotManagement /></AuthGuard>} />
                <Route path="/admin/menus" element={<AuthGuard><MenuManagement /></AuthGuard>} />
                <Route path="/admin/reservations" element={<AuthGuard><ReservationDetail /></AuthGuard>} />
                <Route path="/admin/settings" element={<AuthGuard><AdminSettings /></AuthGuard>} />
            </Routes>
        </>
    )
}

export default App
