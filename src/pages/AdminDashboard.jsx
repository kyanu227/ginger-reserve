/**
 * 管理ダッシュボード（/ginger-staff）
 * KPI カード（今日/今月/売上）+ 直近予約一覧 + クイックアクション
 * 予約詳細モーダル（編集・ステータス変更）をダッシュボード内で完結
 * 関連: api/reservations.js, api/stats.js
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getMenus, getOptions, getStats, formatPrice, getStatusLabel, getStatusColor, updateReservation, cancelReservation, getMenuName } from '../lib/api'
import { DAY_LABELS, timeToMin, minToTime } from '../lib/constants'

const IcoCalendar = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 7h14" stroke="currentColor" strokeWidth="1.5"/><path d="M6 2v2M12 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IcoChart = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="10" width="3.5" height="6" rx="1" fill="currentColor" opacity=".7"/><rect x="7.25" y="6.5" width="3.5" height="9.5" rx="1" fill="currentColor" opacity=".85"/><rect x="12.5" y="2.5" width="3.5" height="13" rx="1" fill="currentColor"/></svg>
const IcoYen = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l5 6 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 9h10M4 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 15v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IcoUsers = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M1 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 3.5a3 3 0 110 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17 15c0-2.5-1.6-4.6-3.8-5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IcoClock = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 4.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoList = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 4.5h9M3 7.5h9M3 10.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>

// ── フィールドラベル ──────────────────────────────────────────
function FieldLabel({ children }) {
    return (
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            {children}
        </label>
    )
}

// ── 予約詳細モーダル（ダッシュボード用） ─────────────────────────
function ReservationModal({ res, menus, allOptions, onClose, onUpdated }) {
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const bookableMenus = useMemo(() => menus.filter(m => !m.isCategory && m.active), [menus])

    useEffect(() => {
        setEditing(false)
        setEditForm({
            menuId: res.menuId || '',
            date: res.date || '',
            time: res.time || '',
            guests: res.guests || 1,
            options: [...(res.options || [])],
            notes: res.notes || '',
            totalPrice: res.totalPrice || 0,
        })
    }, [res.id])

    function recalcPrice(menuId, guests, options) {
        const menu = menus.find(m => m.id === menuId)
        let price = (menu?.price || 0) * guests
        options.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt) price += opt.price * guests
        })
        return price
    }

    function updateField(field, value) {
        setEditForm(prev => {
            const next = { ...prev, [field]: value }
            if (['menuId', 'guests', 'options'].includes(field)) {
                next.totalPrice = recalcPrice(
                    field === 'menuId' ? value : next.menuId,
                    field === 'guests' ? value : next.guests,
                    field === 'options' ? value : next.options
                )
            }
            return next
        })
    }

    async function handleSave() {
        const menu = menus.find(m => m.id === editForm.menuId)
        const dur = menu?.duration || (menu?.durations ? menu.durations[0] : 30) || 30
        const endTime = minToTime(timeToMin(editForm.time) + dur)
        const updates = { ...editForm, endTime }
        await updateReservation(res.id, updates)
        onUpdated({ ...res, ...updates })
        setEditing(false)
    }

    async function handleStatusChange(newStatus) {
        const labels = { confirmed: '確定', cancelled: 'キャンセル', completed: '来店済み' }
        const msg = newStatus === 'cancelled'
            ? `${res.lastName}${res.firstName}様の予約をキャンセルしますか？`
            : `${res.lastName}${res.firstName}様の予約を「${labels[newStatus]}」に変更しますか？`
        if (!confirm(msg)) return

        if (newStatus === 'cancelled') {
            await cancelReservation(res.id)
        } else {
            await updateReservation(res.id, { status: newStatus })
        }
        onUpdated({ ...res, status: newStatus })
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
                zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                paddingTop: 40,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div style={{
                background: 'white', borderRadius: 16,
                width: '92%', maxWidth: 520, maxHeight: '85vh',
                overflow: 'auto', padding: 0,
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}>
                {/* ヘッダー */}
                <div style={{
                    padding: '18px 24px 14px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                    borderRadius: '16px 16px 0 0',
                    color: '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            {res.lastName} {res.firstName} 様
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2 }}>{res.id}</div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff', fontSize: '1rem',
                    }}>×</button>
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                    {editing ? (
                        /* ── 編集モード ── */
                        <div>
                            {/* コース */}
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>コース</FieldLabel>
                                <select className="form-input" value={editForm.menuId}
                                    onChange={e => updateField('menuId', e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }}>
                                    {bookableMenus.map(m => (
                                        <option key={m.id} value={m.id}>{m.icon || ''} {m.name} ({formatPrice(m.price || 0)})</option>
                                    ))}
                                </select>
                            </div>

                            {/* 日時・人数 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 10, marginBottom: 12 }}>
                                <div>
                                    <FieldLabel>日付</FieldLabel>
                                    <input type="date" className="form-input" value={editForm.date}
                                        onChange={e => updateField('date', e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <FieldLabel>時刻</FieldLabel>
                                    <input type="time" className="form-input" value={editForm.time} step="600"
                                        onChange={e => updateField('time', e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <FieldLabel>人数</FieldLabel>
                                    <input type="number" className="form-input" min="1" max="10" value={editForm.guests}
                                        onChange={e => updateField('guests', parseInt(e.target.value) || 1)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            {/* オプション */}
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>オプション</FieldLabel>
                                {allOptions.filter(o => o.active).map(opt => (
                                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={editForm.options.includes(opt.id)}
                                            onChange={e => {
                                                const newOpts = e.target.checked
                                                    ? [...editForm.options, opt.id]
                                                    : editForm.options.filter(id => id !== opt.id)
                                                updateField('options', newOpts)
                                            }} />
                                        {opt.icon} {opt.name} {opt.price > 0 && `(${formatPrice(opt.price)})`}
                                    </label>
                                ))}
                            </div>

                            {/* 金額 */}
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>合計金額</FieldLabel>
                                <input type="number" className="form-input" value={editForm.totalPrice}
                                    onChange={e => setEditForm(f => ({ ...f, totalPrice: parseInt(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }} />
                            </div>

                            {/* 備考 */}
                            <div style={{ marginBottom: 16 }}>
                                <FieldLabel>備考</FieldLabel>
                                <textarea className="form-input" rows="2" value={editForm.notes}
                                    onChange={e => updateField('notes', e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem', resize: 'vertical' }} />
                            </div>

                            {/* 保存/やめる */}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>保存</button>
                                <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>やめる</button>
                            </div>

                            {/* キャンセルボタン（編集モード内） */}
                            {res.status !== 'cancelled' && res.status !== 'completed' && (
                                <button className="btn btn-secondary" onClick={() => handleStatusChange('cancelled')}
                                    style={{
                                        width: '100%', marginTop: 12, color: '#c0392b', borderColor: '#c0392b',
                                        fontSize: '0.82rem', padding: '8px 0',
                                    }}>
                                    この予約をキャンセルする
                                </button>
                            )}
                        </div>
                    ) : (
                        /* ── 表示モード ── */
                        <div>
                            <div style={{ fontSize: '0.88rem' }}>
                                {[
                                    ['お客様', `${res.lastName} ${res.firstName}`],
                                    ['電話', res.phone || '—'],
                                    ['メール', res.email || '—'],
                                    ['コース', getMenuName(res.menuId, menus, { withIcon: true })],
                                    ['日時', `${res.date} ${res.time}〜`],
                                    ['人数', `${res.guests}名`],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ display: 'flex', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>{label}</span>
                                        <span style={{ flex: 1 }}>{value}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>ステータス</span>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                                        background: getStatusColor(res.status) + '18', color: getStatusColor(res.status),
                                    }}>
                                        {getStatusLabel(res.status)}
                                    </span>
                                </div>
                            </div>

                            {/* オプション */}
                            <div style={{ marginTop: 16 }}>
                                <FieldLabel>オプション</FieldLabel>
                                {(res.options || []).length > 0 ? (
                                    res.options.map(optId => {
                                        const opt = allOptions.find(o => o.id === optId)
                                        return opt ? <div key={optId} style={{ fontSize: '0.85rem', padding: '2px 0' }}>{opt.icon} {opt.name}</div> : null
                                    })
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>なし</span>
                                )}
                            </div>

                            {/* 備考 */}
                            {res.notes && (
                                <div style={{ marginTop: 12 }}>
                                    <FieldLabel>備考</FieldLabel>
                                    <p style={{ fontSize: '0.85rem', margin: 0 }}>{res.notes}</p>
                                </div>
                            )}

                            {/* 合計金額 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '2px solid var(--primary)' }}>
                                <span style={{ fontWeight: 600 }}>合計金額</span>
                                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(res.totalPrice)}</span>
                            </div>

                            {/* アクションボタン */}
                            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {res.status === 'pending' && (
                                    <button className="btn" onClick={() => handleStatusChange('confirmed')}
                                        style={{ width: '100%', padding: 11, background: '#c4a35a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                        承認して確定する
                                    </button>
                                )}
                                {res.status === 'confirmed' && (
                                    <button className="btn" onClick={() => handleStatusChange('completed')}
                                        style={{ width: '100%', padding: 11, background: '#2c3e50', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                        来店済みにする
                                    </button>
                                )}
                                {res.status !== 'cancelled' && res.status !== 'completed' && (
                                    <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ width: '100%' }}>
                                        編集
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [allOptions, setAllOptions] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedRes, setSelectedRes] = useState(null) // モーダル用

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [res, m, o, s] = await Promise.all([getReservations(), getMenus(), getOptions(), getStats()])
            setReservations(res)
            setMenus(m)
            setAllOptions(o)
            setStats(s)
            setLoading(false)
        }
        load()
    }, [])

    const today = new Date().toISOString().split('T')[0]
    const todayLabel = (() => {
        const d = new Date()
        const dow = DAY_LABELS[d.getDay()]
        return `${d.getMonth()+1}月${d.getDate()}日（${dow}）`
    })()

    const todayReservations = useMemo(() =>
        reservations.filter(r => r.date === today && r.status !== 'cancelled')
            .sort((a, b) => a.time.localeCompare(b.time)),
        [reservations, today])

    const pendingRequests = useMemo(() =>
        reservations.filter(r => r.status === 'pending'),
        [reservations])

    const upcoming = useMemo(() =>
        reservations.filter(r => r.date >= today && r.status !== 'cancelled' && r.status !== 'completed')
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .slice(0, 10),
        [reservations, today])

    async function handleApprove(id, lastName, firstName) {
        if (!confirm(`${lastName}${firstName}様の予約リクエストを承認しますか？`)) return
        try {
            await updateReservation(id, { status: 'confirmed' })
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r))
        } catch (err) {
            alert('承認に失敗しました。')
        }
    }

    // モーダルで更新後に一覧も反映
    function handleResUpdated(updated) {
        setReservations(prev => prev.map(r => r.id === updated.id ? updated : r))
        setSelectedRes(updated)
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content apc"><div className="loading-spinner"></div></main>
            </div>
        )
    }

    const KPI_CARDS = [
        { icon: <IcoCalendar />, value: todayReservations.length, label: '本日の予約', color: '#3A5F56' },
        { icon: <IcoChart />, value: stats?.confirmed || 0, label: '確定予約（全体）', color: '#0057B8' },
        { icon: <IcoYen />, value: formatPrice(stats?.totalRevenue || 0), label: '総売上', color: '#7A5200' },
        { icon: <IcoUsers />, value: stats?.repeatCustomers || 0, label: 'リピーター数', color: '#5B2D8E' },
    ]

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content apc">

                {/* Page header */}
                <div className="apc-header">
                    <div>
                        <h1 className="apc-title">ダッシュボード</h1>
                        <p className="apc-sub">{todayLabel}</p>
                    </div>
                    {pendingRequests.length > 0 && (
                        <div className="apc-alert">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 5v3.5M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            承認待ち <strong>{pendingRequests.length}件</strong>
                        </div>
                    )}
                </div>

                {/* KPI cards */}
                <div className="apc-kpi-grid">
                    {KPI_CARDS.map((card, i) => (
                        <div key={i} className="apc-kpi-card" style={{ '--kc': card.color }}>
                            <div className="apc-kpi-icon">{card.icon}</div>
                            <div className="apc-kpi-val">{card.value}</div>
                            <div className="apc-kpi-label">{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Today's timeline */}
                <div className="apc-section">
                    <div className="apc-section-header">
                        <IcoClock />
                        <span>本日のタイムライン</span>
                        <span className="apc-section-count">{todayReservations.length}</span>
                    </div>
                    {todayReservations.length === 0 ? (
                        <div className="apc-empty">本日の予約はありません</div>
                    ) : (
                        <div className="apc-timeline">
                            {todayReservations.map(r => {
                                const now = new Date().toTimeString().slice(0, 5)
                                const isPast = r.time < now
                                return (
                                    <div key={r.id} className={`apc-tl-item ${isPast ? 'past' : ''}`}>
                                        <div className="apc-tl-time">{r.time}</div>
                                        <div className="apc-tl-dot" />
                                        <div className="apc-tl-body">
                                            <div className="apc-tl-row">
                                                <span className="apc-tl-name">{r.lastName} {r.firstName}<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> 様</span></span>
                                                <span className="apc-badge" style={{ background: getStatusColor(r.status) }}>{getStatusLabel(r.status)}</span>
                                            </div>
                                            <div className="apc-tl-meta">
                                                <span>{getMenuName(r.menuId, menus)}</span>
                                                <span>{r.guests}名</span>
                                                <span>{formatPrice(r.totalPrice)}</span>
                                            </div>
                                            {r.notes && <div className="apc-tl-notes">{r.notes}</div>}
                                            <div className="apc-tl-actions">
                                                {r.status === 'pending' && (
                                                    <button className="apc-btn apc-btn-approve" onClick={() => handleApprove(r.id, r.lastName, r.firstName)}>
                                                        承認する
                                                    </button>
                                                )}
                                                <button className="apc-btn apc-btn-ghost" onClick={() => setSelectedRes(r)}>
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

                {/* Upcoming table */}
                <div className="apc-section">
                    <div className="apc-section-header">
                        <IcoList />
                        <span>今後の予約</span>
                        <span className="apc-section-count">{upcoming.length}</span>
                    </div>
                    {upcoming.length === 0 ? (
                        <div className="apc-empty">予約はありません</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="apc-table">
                                <thead>
                                    <tr>
                                        <th>日付</th><th>時間</th><th>お客様</th>
                                        <th>コース</th><th>人数</th><th>ステータス</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upcoming.map(r => (
                                        <tr key={r.id}>
                                            <td className="apc-td-date">{r.date}</td>
                                            <td><strong>{r.time}</strong></td>
                                            <td>{r.lastName} {r.firstName}</td>
                                            <td>{getMenuName(r.menuId, menus)}</td>
                                            <td>{r.guests}名</td>
                                            <td><span className="apc-badge" style={{ background: getStatusColor(r.status) }}>{getStatusLabel(r.status)}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {r.status === 'pending' && (
                                                        <button className="apc-btn apc-btn-sm apc-btn-approve" onClick={() => handleApprove(r.id, r.lastName, r.firstName)}>承認</button>
                                                    )}
                                                    <button className="apc-btn apc-btn-sm apc-btn-ghost" onClick={() => setSelectedRes(r)}>詳細</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 予約詳細モーダル */}
                {selectedRes && (
                    <ReservationModal
                        res={selectedRes}
                        menus={menus}
                        allOptions={allOptions}
                        onClose={() => setSelectedRes(null)}
                        onUpdated={handleResUpdated}
                    />
                )}
            </main>
        </div>
    )
}
