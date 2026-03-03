import { useState, useEffect, useMemo } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getStats, formatPrice } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts'

const COLORS = ['#8B6914', '#4a7c59', '#c4a35a', '#6a9f5b', '#a0522d', '#2e8b57', '#d4a76a']

export default function StatisticsView() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const s = await getStats()
            setStats(s)
            setLoading(false)
        }
        load()
    }, [])

    if (loading || !stats) {
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
                <h1 className="admin-page-title">📈 統計・分析</h1>
                <p className="admin-page-desc">予約データからビジネスの傾向を把握できます</p>

                {/* Summary Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-card-icon">💰</div>
                        <div className="stat-card-body"><div className="stat-card-value">{formatPrice(stats.totalRevenue)}</div><div className="stat-card-label">総売上（見込み）</div></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-icon">📊</div>
                        <div className="stat-card-body"><div className="stat-card-value">{stats.confirmed}</div><div className="stat-card-label">確定予約数</div></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-icon">🔄</div>
                        <div className="stat-card-body"><div className="stat-card-value">{stats.repeatCustomers}</div><div className="stat-card-label">リピーター数</div></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-icon">📉</div>
                        <div className="stat-card-body"><div className="stat-card-value">{stats.cancelRate}%</div><div className="stat-card-label">キャンセル率</div></div>
                    </div>
                </div>

                {/* New vs Repeat */}
                <div className="card" style={{ marginTop: 'var(--sp-8)' }}>
                    <h2 style={{ marginBottom: 'var(--sp-4)' }}>👥 新規 vs リピーター</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4a7c59' }}>{stats.newCustomers}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>新規</div>
                        </div>
                        <div style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>:</div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c4a35a' }}>{stats.repeatCustomers}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>リピーター</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {(stats.newCustomers + stats.repeatCustomers) > 0
                                    ? Math.round((stats.repeatCustomers / (stats.newCustomers + stats.repeatCustomers)) * 100)
                                    : 0}%
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>リピート率</div>
                        </div>
                    </div>
                </div>

                {/* Monthly Revenue & Count */}
                <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
                    <h2 style={{ marginBottom: 'var(--sp-4)' }}>📈 月別予約数・売上推移</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={stats.monthly}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B6914" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8B6914" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value, name) => [name === 'revenue' ? formatPrice(value) : value + '件', name === 'revenue' ? '売上' : '予約数']} />
                            <Legend formatter={(value) => value === 'revenue' ? '売上' : '予約数'} />
                            <Area yAxisId="left" type="monotone" dataKey="count" stroke="#4a7c59" fill="#4a7c5933" name="count" />
                            <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#8B6914" fill="url(#colorRevenue)" name="revenue" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Two charts side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)', marginTop: 'var(--sp-6)' }}>
                    {/* Course Popularity */}
                    <div className="card">
                        <h2 style={{ marginBottom: 'var(--sp-4)' }}>🏆 コース別人気度</h2>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={stats.courseStats} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {stats.courseStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Hourly Distribution */}
                    <div className="card">
                        <h2 style={{ marginBottom: 'var(--sp-4)' }}>⏰ 時間帯別予約数</h2>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.hourly}>
                                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v) => [v + '件', '予約数']} />
                                <Bar dataKey="count" fill="#8B6914" radius={[4, 4, 0, 0]}>
                                    {stats.hourly.map((entry, i) => (
                                        <Cell key={i} fill={entry.count > 3 ? '#4a7c59' : '#c4a35a'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Day of Week */}
                <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
                    <h2 style={{ marginBottom: 'var(--sp-4)' }}>📅 曜日別予約数</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={stats.dayOfWeek}>
                            <XAxis dataKey="day" tick={{ fontSize: 14 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => [v + '件', '予約数']} />
                            <Bar dataKey="count" fill="#4a7c59" radius={[6, 6, 0, 0]}>
                                {stats.dayOfWeek.map((entry, i) => (
                                    <Cell key={i} fill={entry.day === '日' ? '#c0392b44' : (entry.day === '土' ? '#2980b9' : '#4a7c59')} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </main>
        </div>
    )
}
