import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getMenus, getStats, formatPrice, getStatusLabel, getStatusColor, updateReservation } from '../lib/api'

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [res, m, s] = await Promise.all([
                getReservations(),
                getMenus(),
                getStats()
            ])
            setReservations(res)
            setMenus(m)
            setStats(s)
            setLoading(false)
        }
        load()
    }, [])

    const today = new Date().toISOString().split('T')[0]
    const todayReservations = useMemo(() =>
        reservations.filter(r => r.date === today && r.status !== 'cancelled')
            .sort((a, b) => a.time.localeCompare(b.time)),
        [reservations, today]
    )

    const upcoming = useMemo(() =>
        reservations.filter(r => r.date >= today && r.status !== 'cancelled')
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .slice(0, 10),
        [reservations, today]
    )

    const getMenuName = (menuId) => {
        const menu = menus.find(m => m.id === menuId)
        return menu ? `${menu.icon} ${menu.name}` : menuId
    }

    async function handleApprove(id, lastName, firstName) {
        if (!confirm(`${lastName}${firstName}様の予約リクエストを承認し、確定しますか？お客様に確定メールが送信されます。`)) return

        try {
            await updateReservation(id, { status: 'confirmed' })
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r))
            alert('予約を承認しました。')
        } catch (err) {
            console.error(err)
            alert('承認に失敗しました。')
        }
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content"><div className="loading-spinner"></div></main>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                <h1 className="admin-page-title">📋 ダッシュボード</h1>
                <p className="admin-page-desc">予約状況の概要</p>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                        <div className="stat-card-icon">📅</div>
                        <div className="stat-card-body">
                            <div className="stat-card-value">{todayReservations.length}</div>
                            <div className="stat-card-label">本日の予約</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                        <div className="stat-card-icon">📊</div>
                        <div className="stat-card-body">
                            <div className="stat-card-value">{stats?.confirmed || 0}</div>
                            <div className="stat-card-label">確定予約数 (全体)</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #c4a35a' }}>
                        <div className="stat-card-icon">💰</div>
                        <div className="stat-card-body">
                            <div className="stat-card-value">{formatPrice(stats?.totalRevenue || 0)}</div>
                            <div className="stat-card-label">総売上</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #2980b9' }}>
                        <div className="stat-card-icon">🔄</div>
                        <div className="stat-card-body">
                            <div className="stat-card-value">{stats?.repeatCustomers || 0}</div>
                            <div className="stat-card-label">リピーター数</div>
                        </div>
                    </div>
                </div>

                {/* Today's Reservations (Timeline View) */}
                <div className="card" style={{ marginTop: 'var(--sp-8)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--sp-5)' }}>
                        🕐 本日のタイムライン ({todayReservations.length}件)
                    </h2>
                    {todayReservations.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-8)' }}>本日の予約はありません</p>
                    ) : (
                        <div className="timeline">
                            {todayReservations.map((r) => {
                                const isPast = r.time < new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                                const isDone = r.status === 'completed'
                                return (
                                    <div key={r.id} className={`timeline-item ${isDone ? 'completed' : isPast ? 'active' : ''}`}>
                                        <div className="timeline-marker"></div>
                                        <div className="timeline-content">
                                            <div className="timeline-header">
                                                <div className="timeline-time">{r.time}</div>
                                                <span className="badge" style={{ background: getStatusColor(r.status), color: '#fff' }}>
                                                    {getStatusLabel(r.status)}
                                                </span>
                                            </div>
                                            <div className="timeline-customer">
                                                {r.lastName} {r.firstName} 様
                                            </div>
                                            <div className="timeline-details">
                                                <span>
                                                    <span className="mini-indicator">💆</span>
                                                    {getMenuName(r.menuId)}
                                                </span>
                                                <span>
                                                    <span className="mini-indicator">👥</span>
                                                    {r.guests}名
                                                </span>
                                                <span>
                                                    <span className="mini-indicator">💰</span>
                                                    {formatPrice(r.totalPrice)}
                                                </span>
                                            </div>
                                            {r.notes && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)', padding: 'var(--sp-2)', background: 'var(--bg)', borderRadius: 'var(--r-sm)' }}>
                                                    📝 {r.notes}
                                                </div>
                                            )}
                                            <div className="timeline-actions">
                                                {r.status === 'pending' && (
                                                    <button className="action-btn" style={{ background: '#c4a35a', color: '#fff', border: 'none' }} onClick={() => handleApprove(r.id, r.lastName, r.firstName)}>
                                                        ✅ 承認
                                                    </button>
                                                )}
                                                {r.status !== 'completed' && r.status !== 'pending' && (
                                                    <button className="action-btn success" onClick={() => alert('※開発中: 来店ステータスに変更')}>
                                                        ✓ 来店済にする
                                                    </button>
                                                )}
                                                <button className="action-btn" onClick={() => navigate(`/admin/reservations?id=${r.id}`)}>
                                                    詳細
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Upcoming Reservations */}
                <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--sp-5)' }}>📆 今後の予約</h2>
                    {upcoming.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-8)' }}>予約はありません</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>日付</th>
                                        <th>時間</th>
                                        <th>お客様</th>
                                        <th>コース</th>
                                        <th>人数</th>
                                        <th>ステータス</th>
                                        <th>アクション</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upcoming.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.date}</td>
                                            <td style={{ fontWeight: 600 }}>{r.time}</td>
                                            <td>{r.lastName} {r.firstName}</td>
                                            <td>{getMenuName(r.menuId)}</td>
                                            <td>{r.guests}名</td>
                                            <td><span className="badge" style={{ background: getStatusColor(r.status), color: '#fff' }}>{getStatusLabel(r.status)}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {r.status === 'pending' && (
                                                        <button className="action-btn" style={{ padding: '4px 8px', fontSize: '0.7rem', background: '#c4a35a', color: '#fff', border: 'none' }} onClick={() => handleApprove(r.id, r.lastName, r.firstName)}>
                                                            承認
                                                        </button>
                                                    )}
                                                    <button className="action-btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => navigate(`/admin/reservations?id=${r.id}`)}>
                                                        詳細
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
