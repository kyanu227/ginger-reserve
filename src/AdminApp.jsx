/**
 * 管理画面ルーター（admin.html エントリ）
 * /ginger-staff/** の全ルート定義。AuthGuard で認証必須
 * 新ページ追加時: ここに Route + AdminSidebar にリンク追加
 */
import { Routes, Route } from 'react-router-dom'
import { RoleProvider } from './lib/RoleContext'
import AdminDashboard from './pages/AdminDashboard'
import CalendarView from './pages/CalendarView'
import StatisticsView from './pages/StatisticsView'
import SlotManagement from './pages/SlotManagement'
import MenuManagement from './pages/MenuManagement'
import ReservationDetail from './pages/ReservationDetail'
import AuthGuard from './components/AuthGuard'
import AdminSettings from './pages/AdminSettings'
import CustomerManagement from './pages/CustomerManagement'

function AdminApp() {
    return (
        <RoleProvider>
            <Routes>
                <Route path="/ginger-staff" element={<AuthGuard><CalendarView /></AuthGuard>} />
                <Route path="/ginger-staff/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
                <Route path="/ginger-staff/stats" element={<AuthGuard><StatisticsView /></AuthGuard>} />
                <Route path="/ginger-staff/slots" element={<AuthGuard><SlotManagement /></AuthGuard>} />
                <Route path="/ginger-staff/menus" element={<AuthGuard><MenuManagement /></AuthGuard>} />
                <Route path="/ginger-staff/reservations" element={<AuthGuard><ReservationDetail /></AuthGuard>} />
                <Route path="/ginger-staff/customers" element={<AuthGuard><CustomerManagement /></AuthGuard>} />
                <Route path="/ginger-staff/settings" element={<AuthGuard><AdminSettings /></AuthGuard>} />
            </Routes>
        </RoleProvider>
    )
}

export default AdminApp
