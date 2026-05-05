/**
 * 管理画面共通サイドバー
 * NAV_ITEMS 配列でナビリンクを定義。折りたたみ対応
 * 新ページ追加時: NAV_ITEMS にエントリを追加する
 */
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useRole } from '../lib/RoleContext'

const NAV_ITEMS = [
    {
        section: 'メイン',
        items: [
            {
                path: '/ginger-staff', label: '予約台帳',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="5" cy="10" r="1" fill="currentColor"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="11" cy="10" r="1" fill="currentColor"/></svg>
            },
            {
                path: '/ginger-staff/dashboard', label: 'ダッシュボード',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/></svg>
            },
            {
                path: '/ginger-staff/slots', label: '予約枠管理',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><rect x="4" y="8.5" width="2" height="2" rx=".5" fill="currentColor"/><rect x="7" y="8.5" width="2" height="2" rx=".5" fill="currentColor"/><rect x="10" y="8.5" width="2" height="2" rx=".5" fill="currentColor"/></svg>
            },
            {
                path: '/ginger-staff/reservations', label: '予約管理',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            },
            {
                path: '/ginger-staff/customers', label: '名簿管理',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            },
        ]
    },
    {
        section: '設定',
        items: [
            {
                path: '/ginger-staff/menus', label: 'メニュー管理',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2" width="13" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="1.5" y="7.5" width="13" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="1.5" y="13" width="8" height="1.5" rx=".7" fill="currentColor" opacity=".5"/></svg>
            },
            {
                path: '/ginger-staff/stats', label: '統計',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="9" width="3" height="5.5" rx=".8" fill="currentColor" opacity=".7"/><rect x="6.5" y="5.5" width="3" height="9" rx=".8" fill="currentColor" opacity=".85"/><rect x="11.5" y="2" width="3" height="12.5" rx=".8" fill="currentColor"/></svg>
            },
            {
                path: '/ginger-staff/settings', label: 'システム設定',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            },
        ]
    }
]

const ROLE_LABELS = { admin: '管理者', staff: 'スタッフ' }
const ROLE_COLORS = { admin: '#4a7c59', staff: '#c4a35a' }

export default function AdminSidebar() {
    const location = useLocation()
    const { user, role } = useRole()
    const [collapsed, setCollapsed] = useState(() =>
        localStorage.getItem('gingerSidebarCollapsed') === 'true'
    )

    function toggleCollapse() {
        const next = !collapsed
        setCollapsed(next)
        localStorage.setItem('gingerSidebarCollapsed', next)
    }

    async function handleLogout() {
        await signOut(auth)
        window.location.href = '/ginger-staff'
    }

    return (
        <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand */}
            <div className="asb-brand">
                <div className="asb-brand-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 2C10 2 6 5 6 9.5C6 12.5 7.8 15 10 16C12.2 15 14 12.5 14 9.5C14 5 10 2 10 2Z" fill="white" opacity=".9"/>
                        <path d="M10 16V18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M10 10C10 10 8 8 6.5 9.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                        <path d="M10 12C10 12 12 10 13.5 11.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                </div>
                {!collapsed && (
                    <div className="asb-brand-text">
                        <span className="asb-brand-name">Ginger</span>
                        <span className="asb-brand-sub">管理システム</span>
                    </div>
                )}
                <button className="asb-collapse-btn" onClick={toggleCollapse} title={collapsed ? '展開' : '折りたたむ'}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="asb-nav">
                {NAV_ITEMS.map(group => (
                    <div key={group.section} className="asb-section">
                        {!collapsed && <span className="asb-section-label">{group.section}</span>}
                        {group.items.map(item => {
                            const isActive = location.pathname === item.path
                            return (
                                <Link key={item.path} to={item.path}
                                    className={`asb-item ${isActive ? 'active' : ''}`}
                                    title={collapsed ? item.label : undefined}>
                                    <span className="asb-item-icon">{item.icon}</span>
                                    {!collapsed && <span className="asb-item-label">{item.label}</span>}
                                    {!collapsed && isActive && <span className="asb-item-dot" />}
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="asb-footer">
                <a href="/" target="_blank" rel="noopener noreferrer"
                    className="asb-footer-link" title={collapsed ? '予約ページ' : undefined}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M8 1h4v4M12 1L6.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {!collapsed && '予約ページ'}
                </a>
                {user && (
                    <div className="asb-user">
                        <div className="asb-user-avatar" title={collapsed ? `${user.email} (${ROLE_LABELS[role] || role})` : undefined}>
                            {(user.email || 'A')[0].toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="asb-user-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="asb-user-email" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {user.email}
                                    </span>
                                    {role && (
                                        <span style={{
                                            fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
                                            background: (ROLE_COLORS[role] || '#888') + '25',
                                            color: ROLE_COLORS[role] || '#888'
                                        }}>
                                            {ROLE_LABELS[role] || role}
                                        </span>
                                    )}
                                </div>
                                <button className="asb-logout-btn" onClick={handleLogout}>ログアウト</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    )
}
