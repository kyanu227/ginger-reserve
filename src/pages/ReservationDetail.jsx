import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getMenus, getOptions, updateReservation, cancelReservation, formatPrice, getStatusLabel, getStatusColor, formatDate } from '../lib/api'

export default function ReservationDetail() {
    const [searchParams] = useSearchParams()
    const selectedId = searchParams.get('id')

    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [allOptions, setAllOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [selectedRes, setSelectedRes] = useState(null)
    const [editing, setEditing] = useState(false)
    const [editOptions, setEditOptions] = useState([])
    const [editNotes, setEditNotes] = useState('')

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
                if (found) setSelectedRes(found)
            }
        }
        load()
    }, [selectedId])

    const filteredReservations = useMemo(() => {
        let res = [...reservations]
        if (filter !== 'all') res = res.filter(r => r.status === filter)
        return res.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    }, [reservations, filter])

    const getMenuName = (menuId) => {
        const menu = menus.find(m => m.id === menuId)
        return menu ? `${menu.icon} ${menu.name}` : menuId
    }

    function openDetail(res) {
        setSelectedRes(res)
        setEditOptions([...(res.options || [])])
        setEditNotes(res.notes || '')
        setEditing(false)
    }

    async function handleSaveEdit() {
        if (!selectedRes) return

        // Recalculate total price
        const menu = menus.find(m => m.id === selectedRes.menuId)
        let totalPrice = (menu?.price || 0) * (selectedRes.guests || 1)
        editOptions.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt) totalPrice += opt.price * (selectedRes.guests || 1)
        })

        await updateReservation(selectedRes.id, {
            options: editOptions,
            notes: editNotes,
            totalPrice
        })

        // Update local state
        setReservations(prev => prev.map(r =>
            r.id === selectedRes.id ? { ...r, options: editOptions, notes: editNotes, totalPrice } : r
        ))
        setSelectedRes(prev => ({ ...prev, options: editOptions, notes: editNotes, totalPrice }))
        setEditing(false)
        alert('更新しました')
    }

    async function handleCancel() {
        if (!selectedRes) return
        if (!confirm(`${selectedRes.lastName}${selectedRes.firstName}様の予約をキャンセルしますか？`)) return

        await cancelReservation(selectedRes.id)
        setReservations(prev => prev.map(r => r.id === selectedRes.id ? { ...r, status: 'cancelled' } : r))
        setSelectedRes(prev => ({ ...prev, status: 'cancelled' }))
        alert('キャンセルしました')
    }

    async function handleApprove() {
        if (!selectedRes) return
        if (!confirm(`${selectedRes.lastName}${selectedRes.firstName}様の予約を承認し、確定しますか？お客様には確定メールが送信されます。`)) return

        await updateReservation(selectedRes.id, { status: 'confirmed' })
        setReservations(prev => prev.map(r => r.id === selectedRes.id ? { ...r, status: 'confirmed' } : r))
        setSelectedRes(prev => ({ ...prev, status: 'confirmed' }))
        alert('予約を承認し、確定しました。')
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
                <h1 style={{ marginBottom: 'var(--sp-1)' }}>📝 予約管理</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>予約の確認・編集・キャンセルができます</p>

                <div style={{ display: 'grid', gridTemplateColumns: selectedRes ? '1fr 1fr' : '1fr', gap: 'var(--sp-6)' }}>
                    {/* Reservation List */}
                    <div>
                        {/* Filter */}
                        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
                            {[['all', '全て'], ['confirmed', '確定'], ['pending', '保留'], ['cancelled', 'キャンセル']].map(([val, label]) => (
                                <button key={val} className={`btn ${filter === val ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setFilter(val)} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredReservations.map(r => (
                                <div key={r.id} className="card" onClick={() => openDetail(r)}
                                    style={{
                                        marginBottom: 'var(--sp-2)', cursor: 'pointer',
                                        border: selectedRes?.id === r.id ? '2px solid var(--primary)' : '2px solid transparent',
                                        transition: 'border-color 0.2s ease'
                                    }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{r.lastName} {r.firstName}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {r.date} {r.time} | {getMenuName(r.menuId)} | {r.guests}名
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className="badge" style={{ background: getStatusColor(r.status), color: '#fff' }}>
                                                {getStatusLabel(r.status)}
                                            </span>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>{formatPrice(r.totalPrice)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Panel */}
                    {selectedRes && (
                        <div className="card" style={{ position: 'sticky', top: 'var(--sp-6)', alignSelf: 'start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                                <h2 style={{ fontSize: '1.1rem' }}>予約詳細</h2>
                                <button onClick={() => setSelectedRes(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                            </div>

                            <div style={{ marginBottom: 'var(--sp-2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                予約番号: {selectedRes.id}
                            </div>

                            <table className="confirmation-table" style={{ width: '100%' }}>
                                <tbody>
                                    <tr><th>お客様</th><td>{selectedRes.lastName} {selectedRes.firstName}</td></tr>
                                    <tr><th>電話</th><td>{selectedRes.phone}</td></tr>
                                    <tr><th>メール</th><td>{selectedRes.email}</td></tr>
                                    <tr><th>コース</th><td>{getMenuName(selectedRes.menuId)}</td></tr>
                                    <tr><th>日時</th><td>{formatDate(selectedRes.date)} {selectedRes.time}〜</td></tr>
                                    <tr><th>人数</th><td>{selectedRes.guests}名</td></tr>
                                    <tr>
                                        <th>ステータス</th>
                                        <td>
                                            <span className="badge" style={{ background: getStatusColor(selectedRes.status), color: '#fff' }}>
                                                {getStatusLabel(selectedRes.status)}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Options Section */}
                            <div style={{ marginTop: 'var(--sp-6)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-2)' }}>オプション</h3>
                                {editing ? (
                                    <div>
                                        {allOptions.filter(o => o.active).map(opt => (
                                            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-1) 0', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={editOptions.includes(opt.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setEditOptions(prev => [...prev, opt.id])
                                                        else setEditOptions(prev => prev.filter(id => id !== opt.id))
                                                    }} />
                                                {opt.icon} {opt.name} ({opt.price === 0 ? '無料' : formatPrice(opt.price)})
                                            </label>
                                        ))}
                                        <div className="form-group" style={{ marginTop: 'var(--sp-2)' }}>
                                            <label className="form-label">備考</label>
                                            <textarea className="form-input" rows="2" value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
                                            <button className="btn btn-primary" onClick={handleSaveEdit}>保存</button>
                                            <button className="btn btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {(selectedRes.options || []).length > 0 ? (
                                            selectedRes.options.map(optId => {
                                                const opt = allOptions.find(o => o.id === optId)
                                                return opt ? <div key={optId} style={{ padding: '2px 0' }}>{opt.icon} {opt.name}</div> : null
                                            })
                                        ) : (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>オプションなし</p>
                                        )}
                                        {selectedRes.notes && (
                                            <p style={{ marginTop: 'var(--sp-2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                備考: {selectedRes.notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Total */}
                            <div style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-4)', borderTop: '2px solid var(--primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600 }}>合計金額</span>
                                    <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        {formatPrice(selectedRes.totalPrice)}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            {selectedRes.status === 'pending' && (
                                <div style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-2)' }}>
                                    <button className="btn btn-primary" onClick={handleApprove} style={{ width: '100%', background: '#c4a35a', border: 'none', padding: '12px' }}>
                                        ✅ このリクエストを承認（確定）する
                                    </button>
                                </div>
                            )}

                            {selectedRes.status !== 'cancelled' && (
                                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: selectedRes.status === 'pending' ? 'var(--sp-2)' : 'var(--sp-6)' }}>
                                    {!editing && (
                                        <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ flex: 1 }}>
                                            ✏️ 編集
                                        </button>
                                    )}
                                    <button className="btn btn-secondary" onClick={handleCancel}
                                        style={{ flex: 1, color: '#c0392b', borderColor: '#c0392b' }}>
                                        ❌ キャンセル
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
