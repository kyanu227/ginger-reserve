/**
 * 予約管理（管理画面）
 * 予約一覧・検索・フィルタ + 予約詳細パネル（全フィールド編集）
 * 「本日」タブで当日予約を表示 + 来店済みボタン
 * 管理者から新規予約を追加可能
 * 関連: api/reservations.js, api/gas.js, api/menus.js
 */
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getMenus, getOptions, createReservation, updateReservation, cancelReservation, formatPrice, getStatusLabel, getStatusColor, formatDate, getMenuName } from '../lib/api'
import { timeToMin, minToTime } from '../lib/constants'

// ── フィールドラベル ──────────────────────────────────────────
function FieldLabel({ children }) {
    return (
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            {children}
        </label>
    )
}

// ── 新規予約モーダル ──────────────────────────────────────────
function NewReservationModal({ menus, allOptions, onClose, onCreated }) {
    const bookableMenus = menus.filter(m => !m.isCategory && m.active)
    const [form, setForm] = useState({
        lastName: '', firstName: '', phone: '', email: '',
        menuId: bookableMenus[0]?.id || '', date: new Date().toISOString().split('T')[0],
        time: '10:00', guests: 1, options: [], notes: '', duration: 0,
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const selectedMenu = menus.find(m => m.id === form.menuId)
    const durations = selectedMenu?.durations || [selectedMenu?.duration || 30]

    // メニュー変更時にデフォルトdurationをセット
    useEffect(() => {
        if (selectedMenu) {
            const durs = selectedMenu.durations || [selectedMenu.duration || 30]
            setForm(f => ({ ...f, duration: durs[0] }))
        }
    }, [form.menuId])

    function calcPrice() {
        let price = (selectedMenu?.price || 0) * form.guests
        form.options.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt) price += opt.price * form.guests
        })
        return price
    }

    async function handleSubmit() {
        if (!form.lastName || !form.menuId || !form.date || !form.time) {
            setError('姓・コース・日付・時刻は必須です')
            return
        }
        setSaving(true)
        setError('')
        const totalPrice = calcPrice()
        const dur = form.duration || durations[0] || 30
        const result = await createReservation({
            ...form, totalPrice, totalDuration: dur,
        })
        setSaving(false)
        if (result.success) {
            onCreated(result.id)
        } else {
            setError(result.error || '予約作成に失敗しました')
        }
    }

    const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 30 }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '92%', maxWidth: 520, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                {/* ヘッダー */}
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>新規予約を追加</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                </div>

                <div style={{ padding: '18px 24px 24px' }}>
                    {/* お客様情報 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <div><FieldLabel>姓 *</FieldLabel><input style={inputStyle} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="山田" /></div>
                        <div><FieldLabel>名</FieldLabel><input style={inputStyle} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="太郎" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <div><FieldLabel>電話番号</FieldLabel><input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                        <div><FieldLabel>メール</FieldLabel><input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    </div>

                    {/* コース */}
                    <div style={{ marginBottom: 14 }}>
                        <FieldLabel>コース *</FieldLabel>
                        <select style={inputStyle} value={form.menuId} onChange={e => setForm(f => ({ ...f, menuId: e.target.value }))}>
                            {bookableMenus.map(m => (
                                <option key={m.id} value={m.id}>{m.icon || ''} {m.name} ({formatPrice(m.price || 0)})</option>
                            ))}
                        </select>
                    </div>

                    {/* 時間選択（複数ある場合） */}
                    {durations.length > 1 && (
                        <div style={{ marginBottom: 14 }}>
                            <FieldLabel>時間</FieldLabel>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {durations.map(d => (
                                    <button key={d} className={`btn ${form.duration === d ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ fontSize: '0.82rem', padding: '5px 14px' }}
                                        onClick={() => setForm(f => ({ ...f, duration: d }))}>{d}分</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 日時・人数 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10, marginBottom: 14 }}>
                        <div><FieldLabel>日付 *</FieldLabel><input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                        <div><FieldLabel>時刻 *</FieldLabel><input type="time" style={inputStyle} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} step="600" /></div>
                        <div><FieldLabel>人数</FieldLabel><input type="number" style={inputStyle} min="1" max="10" value={form.guests} onChange={e => setForm(f => ({ ...f, guests: parseInt(e.target.value) || 1 }))} /></div>
                    </div>

                    {/* オプション */}
                    <div style={{ marginBottom: 14 }}>
                        <FieldLabel>オプション</FieldLabel>
                        {allOptions.filter(o => o.active).map(opt => (
                            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: '0.88rem' }}>
                                <input type="checkbox" checked={form.options.includes(opt.id)}
                                    onChange={e => setForm(f => ({
                                        ...f,
                                        options: e.target.checked ? [...f.options, opt.id] : f.options.filter(id => id !== opt.id)
                                    }))} />
                                {opt.icon} {opt.name} {opt.price > 0 && `(${formatPrice(opt.price)})`}
                            </label>
                        ))}
                    </div>

                    {/* 備考 */}
                    <div style={{ marginBottom: 18 }}>
                        <FieldLabel>備考</FieldLabel>
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>

                    {/* 合計 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid var(--primary)', marginBottom: 14 }}>
                        <span style={{ fontWeight: 600 }}>合計金額</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(calcPrice())}</span>
                    </div>

                    {error && <div style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}

                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
                        style={{ width: '100%', padding: 12, fontSize: '0.95rem' }}>
                        {saving ? '作成中...' : '予約を作成'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── メインページ ──────────────────────────────────────────────
export default function ReservationDetail() {
    const [searchParams] = useSearchParams()
    const selectedId = searchParams.get('id')

    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [allOptions, setAllOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('upcoming')
    const [selectedRes, setSelectedRes] = useState(null)
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const [showNewModal, setShowNewModal] = useState(false)
    const [showAll, setShowAll] = useState(false) // 全期間表示トグル

    const today = new Date().toISOString().split('T')[0]
    // 14日前の日付（来店済み・キャンセル・全て等の表示カットオフ）
    const cutoffDate = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - 14)
        return d.toISOString().split('T')[0]
    }, [])

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [res, m, o] = await Promise.all([getReservations(), getMenus(), getOptions()])
            setReservations(res)
            setMenus(m)
            setAllOptions(o)
            setLoading(false)
            if (selectedId) {
                const found = res.find(r => r.id === selectedId)
                if (found) openDetail(found)
            }
        }
        load()
    }, [selectedId])

    // 予約可能メニュー（カテゴリではない + active）
    const bookableMenus = useMemo(() => menus.filter(m => !m.isCategory && m.active), [menus])

    const filteredReservations = useMemo(() => {
        let res = [...reservations]
        if (filter === 'today') {
            res = res.filter(r => r.date === today && r.status !== 'cancelled')
        } else if (filter === 'upcoming') {
            // 今後の予約: 今日以降 + 確定/保留のみ
            res = res.filter(r => r.date >= today && r.status !== 'cancelled' && r.status !== 'completed')
        } else if (filter === 'all') {
            // 全て: showAll でなければ直近14日+未来のみ
            if (!showAll) res = res.filter(r => r.date >= cutoffDate)
        } else if (filter === 'confirmed' || filter === 'pending') {
            // 確定・保留: 今日以降のみ（showAll で全期間）
            res = res.filter(r => r.status === filter)
            if (!showAll) res = res.filter(r => r.date >= today)
        } else {
            // 来店済み・キャンセル: 直近14日（showAll で全期間）
            res = res.filter(r => r.status === filter)
            if (!showAll) res = res.filter(r => r.date >= cutoffDate)
        }
        // 本日・今後タブは時刻順、その他は新しい順
        if (filter === 'today' || filter === 'upcoming') {
            return res.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        }
        return res.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    }, [reservations, filter, today, cutoffDate, showAll])

    // 本日の予約数（タブバッジ用）
    const todayCount = useMemo(() =>
        reservations.filter(r => r.date === today && r.status !== 'cancelled').length,
        [reservations, today]
    )

    // 今後の予約数（タブバッジ用）
    const upcomingCount = useMemo(() =>
        reservations.filter(r => r.date >= today && r.status !== 'cancelled' && r.status !== 'completed').length,
        [reservations, today]
    )

    function openDetail(res) {
        setSelectedRes(res)
        setEditForm({
            menuId: res.menuId || '',
            date: res.date || '',
            time: res.time || '',
            guests: res.guests || 1,
            options: [...(res.options || [])],
            notes: res.notes || '',
            totalPrice: res.totalPrice || 0,
        })
        setEditing(false)
    }

    // 編集中の自動金額計算
    function recalcPrice(menuId, guests, options) {
        const menu = menus.find(m => m.id === menuId)
        let price = (menu?.price || 0) * guests
        options.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt) price += opt.price * guests
        })
        return price
    }

    function updateEditField(field, value) {
        setEditForm(prev => {
            const next = { ...prev, [field]: value }
            // メニュー・人数・オプション変更時に自動再計算
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

    async function handleSaveEdit() {
        if (!selectedRes) return

        // endTime を再計算
        const menu = menus.find(m => m.id === editForm.menuId)
        const dur = menu?.duration || (menu?.durations ? menu.durations[0] : 30) || 30
        const endTime = minToTime(timeToMin(editForm.time) + dur)

        const updates = {
            menuId: editForm.menuId,
            date: editForm.date,
            time: editForm.time,
            endTime,
            guests: editForm.guests,
            options: editForm.options,
            notes: editForm.notes,
            totalPrice: editForm.totalPrice,
        }

        await updateReservation(selectedRes.id, updates)
        const updated = { ...selectedRes, ...updates }
        setReservations(prev => prev.map(r => r.id === selectedRes.id ? updated : r))
        setSelectedRes(updated)
        setEditing(false)
    }

    async function handleStatusChange(newStatus) {
        if (!selectedRes) return
        const labels = { confirmed: '確定', cancelled: 'キャンセル', completed: '来店済み' }
        const msg = newStatus === 'cancelled'
            ? `${selectedRes.lastName}${selectedRes.firstName}様の予約をキャンセルしますか？`
            : `${selectedRes.lastName}${selectedRes.firstName}様の予約を「${labels[newStatus]}」に変更しますか？`
        if (!confirm(msg)) return

        if (newStatus === 'cancelled') {
            await cancelReservation(selectedRes.id)
        } else {
            await updateReservation(selectedRes.id, { status: newStatus })
        }
        const updated = { ...selectedRes, status: newStatus }
        setReservations(prev => prev.map(r => r.id === selectedRes.id ? updated : r))
        setSelectedRes(updated)
    }

    async function handleNewReservationCreated(newId) {
        setShowNewModal(false)
        // リロード
        const res = await getReservations()
        setReservations(res)
        const created = res.find(r => r.id === newId)
        if (created) openDetail(created)
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content"><div className="loading-spinner"></div></main>
            </div>
        )
    }

    const FILTERS = [
        ['upcoming', `今後 (${upcomingCount})`],
        ['today', `本日 (${todayCount})`],
        ['all', '全て'],
        ['confirmed', '確定'],
        ['pending', '保留'],
        ['completed', '来店済み'],
        ['cancelled', 'キャンセル'],
    ]

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>予約管理</h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.82rem' }}>予約の確認・編集・追加ができます</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowNewModal(true)}
                        style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
                        ＋ 新規予約
                    </button>
                </div>

                {/* フィルタータブ */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {FILTERS.map(([val, label]) => (
                        <button key={val}
                            onClick={() => { setFilter(val); setShowAll(false) }}
                            style={{
                                padding: '6px 14px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                border: '1px solid',
                                borderColor: filter === val ? 'var(--primary)' : 'var(--border)',
                                background: filter === val ? 'var(--primary)' : 'transparent',
                                color: filter === val ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s',
                            }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* 件数 + 全期間トグル */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {filteredReservations.length} 件
                        {!showAll && filter !== 'today' && filter !== 'upcoming' && (
                            <span style={{ marginLeft: 4 }}>（直近のみ）</span>
                        )}
                    </span>
                    {filter !== 'today' && filter !== 'upcoming' && (
                        <button
                            onClick={() => setShowAll(v => !v)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600,
                                textDecoration: 'underline', padding: 0,
                            }}>
                            {showAll ? '直近のみ表示' : '全期間を表示'}
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: selectedRes ? '1fr 1fr' : '1fr', gap: 20 }}>
                    {/* ── 予約一覧 ── */}
                    <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                        {filteredReservations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12 }}>
                                {filter === 'today' ? '本日の予約はありません' : '予約がありません'}
                            </div>
                        ) : filteredReservations.map(r => (
                            <div key={r.id} onClick={() => openDetail(r)}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 14px', marginBottom: 6, cursor: 'pointer',
                                    background: 'var(--bg-card)', borderRadius: 10,
                                    border: '1px solid',
                                    borderColor: selectedRes?.id === r.id ? 'var(--primary)' : 'var(--border)',
                                    boxShadow: selectedRes?.id === r.id ? '0 4px 18px rgba(58,95,86,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{r.lastName} {r.firstName}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {filter !== 'today' && `${r.date} `}{r.time} | {getMenuName(r.menuId, menus)} | {r.guests}名
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                        background: getStatusColor(r.status) + '18', color: getStatusColor(r.status),
                                    }}>
                                        {getStatusLabel(r.status)}
                                    </span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>{formatPrice(r.totalPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── 詳細パネル ── */}
                    {selectedRes && (
                        <div style={{
                            background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
                            padding: 20, position: 'sticky', top: 20, alignSelf: 'start',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                        }}>
                            {/* ヘッダー */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>予約詳細</h2>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedRes.id}</span>
                                </div>
                                <button onClick={() => setSelectedRes(null)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                            </div>

                            {editing ? (
                                /* ── 編集モード ── */
                                <div>
                                    {/* お客様名（読み取り専用） */}
                                    <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 14 }}>
                                        <span style={{ fontWeight: 600 }}>{selectedRes.lastName} {selectedRes.firstName}</span>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 10 }}>
                                            {selectedRes.phone} / {selectedRes.email}
                                        </span>
                                    </div>

                                    {/* コース */}
                                    <div style={{ marginBottom: 12 }}>
                                        <FieldLabel>コース</FieldLabel>
                                        <select className="form-input" value={editForm.menuId}
                                            onChange={e => updateEditField('menuId', e.target.value)}>
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
                                                onChange={e => updateEditField('date', e.target.value)} />
                                        </div>
                                        <div>
                                            <FieldLabel>時刻</FieldLabel>
                                            <input type="time" className="form-input" value={editForm.time} step="600"
                                                onChange={e => updateEditField('time', e.target.value)} />
                                        </div>
                                        <div>
                                            <FieldLabel>人数</FieldLabel>
                                            <input type="number" className="form-input" min="1" max="10" value={editForm.guests}
                                                onChange={e => updateEditField('guests', parseInt(e.target.value) || 1)} />
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
                                                        updateEditField('options', newOpts)
                                                    }} />
                                                {opt.icon} {opt.name} {opt.price > 0 && `(${formatPrice(opt.price)})`}
                                            </label>
                                        ))}
                                    </div>

                                    {/* 金額（手動上書き可能） */}
                                    <div style={{ marginBottom: 12 }}>
                                        <FieldLabel>合計金額</FieldLabel>
                                        <input type="number" className="form-input" value={editForm.totalPrice}
                                            onChange={e => setEditForm(f => ({ ...f, totalPrice: parseInt(e.target.value) || 0 }))} />
                                    </div>

                                    {/* 備考 */}
                                    <div style={{ marginBottom: 16 }}>
                                        <FieldLabel>備考</FieldLabel>
                                        <textarea className="form-input" rows="2" value={editForm.notes}
                                            onChange={e => updateEditField('notes', e.target.value)} />
                                    </div>

                                    {/* 保存/やめる */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-primary" onClick={handleSaveEdit} style={{ flex: 1 }}>保存</button>
                                        <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>やめる</button>
                                    </div>

                                    {/* キャンセルボタン（編集モード内に配置して誤操作防止） */}
                                    {selectedRes.status !== 'cancelled' && selectedRes.status !== 'completed' && (
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
                                    {/* 基本情報テーブル */}
                                    <div style={{ fontSize: '0.88rem' }}>
                                        {[
                                            ['お客様', `${selectedRes.lastName} ${selectedRes.firstName}`],
                                            ['電話', selectedRes.phone || '—'],
                                            ['メール', selectedRes.email || '—'],
                                            ['コース', getMenuName(selectedRes.menuId, menus, { withIcon: true })],
                                            ['日時', `${formatDate(selectedRes.date)} ${selectedRes.time}〜`],
                                            ['人数', `${selectedRes.guests}名`],
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ display: 'flex', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>{label}</span>
                                                <span style={{ flex: 1 }}>{value}</span>
                                            </div>
                                        ))}
                                        {/* ステータス行 */}
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>ステータス</span>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                                                background: getStatusColor(selectedRes.status) + '18', color: getStatusColor(selectedRes.status),
                                            }}>
                                                {getStatusLabel(selectedRes.status)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* オプション */}
                                    <div style={{ marginTop: 16 }}>
                                        <FieldLabel>オプション</FieldLabel>
                                        {(selectedRes.options || []).length > 0 ? (
                                            selectedRes.options.map(optId => {
                                                const opt = allOptions.find(o => o.id === optId)
                                                return opt ? <div key={optId} style={{ fontSize: '0.85rem', padding: '2px 0' }}>{opt.icon} {opt.name}</div> : null
                                            })
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>なし</span>
                                        )}
                                    </div>

                                    {/* 備考 */}
                                    {selectedRes.notes && (
                                        <div style={{ marginTop: 12 }}>
                                            <FieldLabel>備考</FieldLabel>
                                            <p style={{ fontSize: '0.85rem', margin: 0 }}>{selectedRes.notes}</p>
                                        </div>
                                    )}

                                    {/* 合計金額 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '2px solid var(--primary)' }}>
                                        <span style={{ fontWeight: 600 }}>合計金額</span>
                                        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(selectedRes.totalPrice)}</span>
                                    </div>

                                    {/* ── アクションボタン ── */}
                                    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {/* 承認ボタン（pending のみ） */}
                                        {selectedRes.status === 'pending' && (
                                            <button className="btn" onClick={() => handleStatusChange('confirmed')}
                                                style={{ width: '100%', padding: 11, background: '#c4a35a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                                承認して確定する
                                            </button>
                                        )}

                                        {/* 来店済みボタン（confirmed のみ） */}
                                        {selectedRes.status === 'confirmed' && (
                                            <button className="btn" onClick={() => handleStatusChange('completed')}
                                                style={{ width: '100%', padding: 11, background: '#2c3e50', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                                来店済みにする
                                            </button>
                                        )}

                                        {/* 編集ボタン（キャンセルは編集モード内に移動済み） */}
                                        {selectedRes.status !== 'cancelled' && selectedRes.status !== 'completed' && (
                                            <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ width: '100%' }}>
                                                編集
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 新規予約モーダル */}
                {showNewModal && (
                    <NewReservationModal
                        menus={menus}
                        allOptions={allOptions}
                        onClose={() => setShowNewModal(false)}
                        onCreated={handleNewReservationCreated}
                    />
                )}
            </main>
        </div>
    )
}
