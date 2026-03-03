import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
    { path: '/admin', icon: '📋', label: 'ダッシュボード' },
    { path: '/admin/slots', icon: '🗓️', label: '予約枠管理' },
    { path: '/admin/reservations', icon: '📝', label: '予約管理' },
    { path: '/admin/calendar', icon: '📅', label: 'カレンダー' },
    { path: '/admin/menus', icon: '🍽️', label: 'メニュー管理' },
    { path: '/admin/stats', icon: '📈', label: '統計' },
    { path: '/admin/settings', icon: '⚙️', label: 'システム設定' },
]

export default function AdminSidebar() {
    const location = useLocation()

    return (
        <aside className="admin-sidebar">
            <h3>管理メニュー</h3>
            <nav>
                {NAV_ITEMS.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={location.pathname === item.path ? 'active' : ''}
                    >
                        <span>{item.icon}</span>
                        {item.label}
                    </Link>
                ))}
            </nav>
        </aside>
    )
}
