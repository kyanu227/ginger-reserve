import { useState, useEffect, useMemo } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getSlots, updateSlots } from '../lib/api'

export default function SlotManagement() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [slots, setSlots] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState('month') // 'month' or 'week'

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    const todayStr = new Date().toISOString().split('T')[0]

    // Paint Tool State
    const [paintStatus, setPaintStatus] = useState('open') // 'open', 'request', 'closed'
    const [isDragging, setIsDragging] = useState(false)
    const [pendingChanges, setPendingChanges] = useState({}) // { 'HH:mm': newStatus }

    // Bulk Settings State
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [bulkForm, setBulkForm] = useState({
        startDate: todayStr,
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '18:00',
        interval: 30, // 30 minutes
        days: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
        status: 'open'
    })
    const [bulkSubmitting, setBulkSubmitting] = useState(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const s = await getSlots(monthStr)
            setSlots(s)
            setLoading(false)
        }
        load()
    }, [monthStr])

    // Global Mouse Up to handle end of drag-and-drop
    useEffect(() => {
        async function handleGlobalMouseUp() {
            if (isDragging) {
                setIsDragging(false)

                // Process pending changes
                const changesArray = Object.entries(pendingChanges)
                if (changesArray.length > 0) {
                    try {
                        // find full slot objects for the changed items
                        const slotsToUpdate = changesArray.map(([time, status]) => {
                            const originalSlot = slots.find(s => s.date === selectedDate && s.time === time)
                            return { ...originalSlot, open: status }
                        })

                        await updateSlots(slotsToUpdate)
                        setPendingChanges({}) // Clear after successful API call

                    } catch (err) {
                        console.error('Failed to update slots via drag', err)
                        alert('一部の枠の更新に失敗しました。画面をリロードします。')
                        // Reload to revert to correct state
                        const s = await getSlots(monthStr)
                        setSlots(s)
                        setPendingChanges({})
                    }
                }
            }
        }

        window.addEventListener('mouseup', handleGlobalMouseUp)
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }, [isDragging, pendingChanges, slots, selectedDate, monthStr])

    const dayNames = ['日', '月', '火', '水', '木', '金', '土']

    // カレンダー用の日付データ生成
    const calendarDays = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const firstDayOfWeek = new Date(year, month, 1).getDay()
        const days = []

        // 前月の空白
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null)
        }

        // 当月の日付
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const daySlots = slots.filter(s => s.date === dateStr)
            const totalBooked = daySlots.reduce((sum, s) => sum + (s.booked || 0), 0)
            const totalCapacity = daySlots.reduce((sum, s) => sum + (s.capacity || 0), 0)
            const isPast = dateStr < todayStr

            days.push({
                date: dateStr,
                day: d,
                dayOfWeek: new Date(year, month, d).getDay(),
                totalBooked,
                totalCapacity,
                slotCount: daySlots.length,
                isPast,
                hasNotice: daySlots.some(s => s.notice)
            })
        }

        return days
    }, [year, month, slots, todayStr])

    // 選択された日の詳細表示
    const [selectedDate, setSelectedDate] = useState(null)

    const selectedDaySlots = useMemo(() => {
        if (!selectedDate) return []
        return slots.filter(s => s.date === selectedDate)
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(s => {
                // Apply pending drag-and-drop changes optimistically
                if (pendingChanges[s.time] !== undefined) {
                    return { ...s, open: pendingChanges[s.time] }
                }
                return s
            })
    }, [slots, selectedDate, pendingChanges])

    // 営業サマリー
    const summary = useMemo(() => {
        const futurSlots = slots.filter(s => s.date >= todayStr)
        const totalSlots = futurSlots.length
        const bookedSlots = futurSlots.filter(s => s.booked > 0).length
        const totalBooked = futurSlots.reduce((sum, s) => sum + (s.booked || 0), 0)
        return { totalSlots, bookedSlots, totalBooked }
    }, [slots, todayStr])

    // 今日の予約
    const todaySlots = useMemo(() => {
        return slots.filter(s => s.date === todayStr && s.booked > 0)
            .sort((a, b) => a.time.localeCompare(b.time))
    }, [slots, todayStr])

    async function handleSetStatus(slot, newStatus) {
        if (slot.open === newStatus || (slot.open === false && newStatus === 'closed') || (slot.open === true && newStatus === 'open')) return;

        try {
            const updatedSlot = { ...slot, open: newStatus }

            // UIを即時反映（オプティミスティックUI）
            setSlots(prev => prev.map(s =>
                (s.date === slot.date && s.time === slot.time) ? updatedSlot : s
            ))

            // APIリクエスト
            await updateSlots([updatedSlot])
        } catch (err) {
            console.error('Failed to update slot status', err)
            // 失敗時は再読み込みして元に戻す
            const s = await getSlots(monthStr)
            setSlots(s)
            alert('枠の更新に失敗しました。')
        }
    }

    // Drag-and-drop Handlers
    function handleSlotMouseDown(time, e) {
        e.preventDefault() // Prevents text selection while dragging
        setIsDragging(true)
        setPendingChanges(prev => ({ ...prev, [time]: paintStatus }))
    }

    function handleSlotMouseEnter(time) {
        if (isDragging) {
            setPendingChanges(prev => ({ ...prev, [time]: paintStatus }))
        }
    }

    async function handleBulkSubmit(e) {
        e.preventDefault()
        setBulkSubmitting(true)
        const newSlots = []
        const start = new Date(bulkForm.startDate)
        const end = new Date(bulkForm.endDate)

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (!bulkForm.days[d.getDay()]) continue

            const dateStr = d.toISOString().split('T')[0]

            const [startH, startM] = bulkForm.startTime.split(':').map(Number)
            const [endH, endM] = bulkForm.endTime.split(':').map(Number)

            const startTotal = startH * 60 + startM
            const endTotal = endH * 60 + endM

            for (let m = startTotal; m <= endTotal; m += Number(bulkForm.interval)) {
                const h = Math.floor(m / 60)
                const min = m % 60
                const timeStr = String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0')

                newSlots.push({
                    date: dateStr,
                    time: timeStr,
                    open: bulkForm.status,
                    capacity: 2 // 既存システム設定のデフォルト
                })
            }
        }

        try {
            await updateSlots(newSlots)
            setShowBulkModal(false)
            // Reload to get actual data
            setLoading(true)
            const s = await getSlots(monthStr)
            setSlots(s)
            setLoading(false)
            alert(`${newSlots.length}件の枠を更新しました`)
        } catch (err) {
            console.error(err)
            alert('一括更新に失敗しました')
            setBulkSubmitting(false)
        }
    }

    async function handleQuickCloseAll(date) {
        if (!confirm(`${date} のすべての枠を「受付停止(×)」に設定しますか？`)) return;

        const daySlots = slots.filter(s => s.date === date).map(s => ({ ...s, open: 'closed' }))
        if (daySlots.length === 0) return;

        try {
            // Optimistic
            setSlots(prev => prev.map(s => s.date === date ? { ...s, open: 'closed' } : s))
            await updateSlots(daySlots)
        } catch (e) {
            console.error(e)
            alert('エラーが発生しました')
            const s = await getSlots(monthStr)
            setSlots(s)
        }
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                <div style={{ marginBottom: 'var(--sp-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ marginBottom: 'var(--sp-1)' }}>📅 予約状況</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>予約状況の確認と営業スケジュールの管理</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowBulkModal(true)}>
                        🛠️ 一括設定（枠の増設・変更）
                    </button>
                </div>

                {/* サマリーカード */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-4)', background: 'linear-gradient(135deg, rgba(74,124,89,0.1), rgba(74,124,89,0.05))' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-dark)' }}>{summary.totalBooked}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>今月の予約数</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-4)', background: 'linear-gradient(135deg, rgba(196,163,90,0.1), rgba(196,163,90,0.05))' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c4a35a' }}>{summary.bookedSlots}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>予約済み枠</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-4)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalSlots}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>利用可能枠</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-4)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700 }}>09:00-21:00</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>営業時間</div>
                    </div>
                </div>

                {/* 今日の予約 */}
                {todaySlots.length > 0 && (
                    <div className="card" style={{ marginBottom: 'var(--sp-6)', borderLeft: '4px solid var(--primary)' }}>
                        <h3 style={{ marginBottom: 'var(--sp-3)', fontSize: '1rem' }}>🔔 本日の予約</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                            {todaySlots.map(s => (
                                <div key={s.time} style={{
                                    padding: '8px 16px', borderRadius: '8px',
                                    background: 'rgba(196,163,90,0.15)', fontWeight: 600
                                }}>
                                    {s.time} — {s.booked}名
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 月ナビゲーション */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                        <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>◀ 前月</button>
                        <h2 style={{ margin: '0 var(--sp-4)' }}>{year}年{month + 1}月</h2>
                        <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>次月 ▶</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#4a7c59', marginRight: 4, verticalAlign: 'middle' }}></span>空き
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#c4a35a', marginRight: 4, verticalAlign: 'middle' }}></span>予約あり
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#e8e0d0', marginRight: 4, verticalAlign: 'middle' }}></span>過去
                        </span>
                    </div>
                </div>

                {/* カレンダーグリッド */}
                {loading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: selectedDate ? '2fr 1fr' : '1fr', gap: 'var(--sp-4)' }}>
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* 曜日ヘッダー */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
                                {dayNames.map((name, i) => (
                                    <div key={name} style={{
                                        textAlign: 'center', padding: '12px 4px', fontWeight: 600, fontSize: '0.85rem',
                                        color: i === 0 ? '#c0392b' : i === 6 ? '#2980b9' : 'var(--text-secondary)',
                                        background: 'rgba(0,0,0,0.02)'
                                    }}>
                                        {name}
                                    </div>
                                ))}
                            </div>

                            {/* 日付セル */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                                {calendarDays.map((day, i) => {
                                    if (!day) return <div key={`empty-${i}`} style={{ minHeight: 80, background: 'rgba(0,0,0,0.01)', borderRight: '1px solid rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}></div>

                                    const isToday = day.date === todayStr
                                    const isSelected = day.date === selectedDate
                                    const bookingRatio = day.totalCapacity > 0 ? day.totalBooked / day.totalCapacity : 0

                                    return (
                                        <div key={day.date}
                                            onClick={() => !day.isPast && setSelectedDate(day.date === selectedDate ? null : day.date)}
                                            style={{
                                                minHeight: 80, padding: '8px', cursor: day.isPast ? 'default' : 'pointer',
                                                borderRight: '1px solid rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.04)',
                                                opacity: day.isPast ? 0.35 : 1,
                                                background: isSelected ? 'rgba(123,96,36,0.1)' : isToday ? 'rgba(74,124,89,0.06)' : 'transparent',
                                                transition: 'background 0.15s ease',
                                                position: 'relative'
                                            }}
                                        >
                                            {/* 日付番号 */}
                                            <div style={{
                                                fontWeight: isToday ? 700 : 500, fontSize: '0.9rem',
                                                color: day.dayOfWeek === 0 ? '#c0392b' : day.dayOfWeek === 6 ? '#2980b9' : 'inherit',
                                                marginBottom: 6
                                            }}>
                                                {isToday && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: 10, marginRight: 4 }}>今日</span>}
                                                {day.day}
                                            </div>

                                            {/* 予約状況バー */}
                                            {!day.isPast && (
                                                <div>
                                                    {day.totalBooked > 0 ? (
                                                        <>
                                                            <div style={{
                                                                height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.08)',
                                                                overflow: 'hidden', marginBottom: 4
                                                            }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 3,
                                                                    width: `${Math.min(bookingRatio * 100, 100)}%`,
                                                                    background: bookingRatio > 0.7 ? '#c0392b' : bookingRatio > 0.4 ? '#c4a35a' : '#4a7c59',
                                                                    transition: 'width 0.3s ease'
                                                                }}></div>
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                                {day.totalBooked}名予約
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ fontSize: '0.7rem', color: '#4a7c59' }}>
                                                            空き
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* お知らせドット */}
                                            {day.hasNotice && (
                                                <div style={{
                                                    position: 'absolute', top: 6, right: 6,
                                                    width: 6, height: 6, borderRadius: '50%', background: '#e67e22'
                                                }}></div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 日別詳細パネル */}
                        {selectedDate && (
                            <div className="card" style={{ position: 'sticky', top: 'var(--sp-4)', alignSelf: 'start' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                        {selectedDate.split('-')[1]}月{selectedDate.split('-')[2]}日
                                        （{dayNames[new Date(selectedDate.replace(/-/g, '/')).getDay()]}）
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                        <button className="action-btn" onClick={() => handleQuickCloseAll(selectedDate)} style={{ padding: '4px 8px' }}>休業にする</button>
                                        <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                                    </div>
                                </div>

                                {/* Paint Tool UI */}
                                <div style={{ marginBottom: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-2)' }}>
                                        🖌️ ペイントツール（なぞって一括変更）
                                    </span>
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                        <label style={{ flex: 1, padding: '6px 10px', background: paintStatus === 'open' ? 'rgba(74,124,89,0.15)' : '#fff', border: `1px solid ${paintStatus === 'open' ? '#4a7c59' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input type="radio" value="open" checked={paintStatus === 'open'} onChange={() => setPaintStatus('open')} style={{ margin: 0 }} />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4a7c59' }}>〇 開放</span>
                                        </label>
                                        <label style={{ flex: 1, padding: '6px 10px', background: paintStatus === 'request' ? 'rgba(230,126,34,0.15)' : '#fff', border: `1px solid ${paintStatus === 'request' ? '#e67e22' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input type="radio" value="request" checked={paintStatus === 'request'} onChange={() => setPaintStatus('request')} style={{ margin: 0 }} />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e67e22' }}>△ リクエスト</span>
                                        </label>
                                        <label style={{ flex: 1, padding: '6px 10px', background: paintStatus === 'closed' ? 'rgba(192,57,43,0.15)' : '#fff', border: `1px solid ${paintStatus === 'closed' ? '#c0392b' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input type="radio" value="closed" checked={paintStatus === 'closed'} onChange={() => setPaintStatus('closed')} style={{ margin: 0 }} />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#c0392b' }}>× 停止</span>
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', userSelect: 'none' }}>
                                    {selectedDaySlots.map(slot => {
                                        const isFull = slot.booked >= slot.capacity
                                        const hasBooking = slot.booked > 0
                                        const isOpen = slot.open === 'open' || slot.open === true
                                        const isRequest = slot.open === 'request'
                                        const isClosed = slot.open === 'closed' || slot.open === false || !slot.open

                                        return (
                                            <div
                                                key={slot.time}
                                                onMouseDown={(e) => handleSlotMouseDown(slot.time, e)}
                                                onMouseEnter={() => handleSlotMouseEnter(slot.time)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '10px 12px', borderRadius: 8,
                                                    background: isClosed ? 'rgba(0,0,0,0.03)' : isRequest ? 'rgba(230,126,34,0.08)' : isFull ? 'rgba(192,57,43,0.08)' : hasBooking ? 'rgba(196,163,90,0.1)' : 'rgba(74,124,89,0.05)',
                                                    border: isClosed ? '1px dashed var(--border)' : isRequest ? '1px dashed rgba(230,126,34,0.5)' : '1px solid transparent',
                                                    opacity: isClosed ? 0.6 : 1,
                                                    transition: 'all 0.1s',
                                                    cursor: 'crosshair', // Indicate paint tool interaction
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', minWidth: 50 }}>{slot.time}</span>
                                                    {/* 予約状況ドット */}
                                                    <div style={{
                                                        width: 8, height: 8, borderRadius: '50%',
                                                        background: isFull ? '#c0392b' : hasBooking ? '#c4a35a' : '#4a7c59'
                                                    }}></div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {slot.booked}/{slot.capacity}名
                                                    </span>
                                                    {isFull && <span style={{ fontSize: '0.75rem', color: '#c0392b', fontWeight: 600 }}>満席</span>}
                                                    {slot.massageChairBooked && <span style={{ fontSize: '0.75rem' }} title="マッサージチェア予約あり">💆</span>}
                                                    {isClosed && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>受付停止</span>}
                                                    {isRequest && <span style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 600 }}>リクエスト制</span>}

                                                    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginLeft: 'var(--sp-2)' }} onClick={e => e.stopPropagation()}>
                                                        <button title="即時予約可（〇）"
                                                            onClick={() => handleSetStatus(slot, 'open')}
                                                            style={{
                                                                background: isOpen ? '#4a7c59' : '#fff', color: isOpen ? '#fff' : 'var(--text-secondary)',
                                                                border: 'none', borderRight: '1px solid var(--border)',
                                                                cursor: 'pointer', padding: '4px 10px', fontWeight: 600, fontSize: '0.8rem', outline: 'none'
                                                            }}>〇</button>
                                                        <button title="リクエスト予約（△）"
                                                            onClick={() => handleSetStatus(slot, 'request')}
                                                            style={{
                                                                background: isRequest ? '#e67e22' : '#fff', color: isRequest ? '#fff' : 'var(--text-secondary)',
                                                                border: 'none', borderRight: '1px solid var(--border)',
                                                                cursor: 'pointer', padding: '4px 10px', fontWeight: 600, fontSize: '0.8rem', outline: 'none'
                                                            }}>△</button>
                                                        <button title="受付停止（×）"
                                                            onClick={() => handleSetStatus(slot, 'closed')}
                                                            style={{
                                                                background: isClosed ? '#c0392b' : '#fff', color: isClosed ? '#fff' : 'var(--text-secondary)',
                                                                border: 'none',
                                                                cursor: 'pointer', padding: '4px 10px', fontWeight: 600, fontSize: '0.8rem', outline: 'none'
                                                            }}>×</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* お知らせ */}
                                {selectedDaySlots.some(s => s.notice) && (
                                    <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
                                        <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--sp-2)', color: 'var(--text-secondary)' }}>📢 この日のお知らせ</h4>
                                        {selectedDaySlots.filter(s => s.notice).map(s => (
                                            <div key={s.time} style={{ fontSize: '0.8rem', padding: '4px 0', color: 'var(--text-secondary)' }}>
                                                <strong>{s.time}</strong> — {s.notice.message}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ヒント */}
                <div style={{ marginTop: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'rgba(74,124,89,0.05)', borderRadius: 'var(--r-lg)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>💡 ヒント</strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: '1.2em', lineHeight: 1.8 }}>
                        <li>予約枠は毎日 <strong>9:00〜21:00</strong> で自動生成されます</li>
                        <li>臨時休業: スプレッドシートの<strong>「臨時休業」</strong>シートに日付を追加</li>
                        <li>お知らせ: スプレッドシートの<strong>「お知らせ」</strong>シートで日時ごとにカスタマイズ</li>
                        <li>カレンダーの日付をクリックすると詳細が表示されます</li>
                    </ul>
                </div>
                {/* Bulk Setting Modal */}
                {showBulkModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div className="modal-content" style={{ background: '#fff', padding: 'var(--sp-6)', borderRadius: 'var(--r-lg)', width: '90%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🛠️ 予約枠の一括設定</h2>
                                <button onClick={() => setShowBulkModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                            </div>

                            <form onSubmit={handleBulkSubmit}>
                                <div className="form-group">
                                    <label className="form-label">対象期間</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                                        <input type="date" className="form-input" required value={bulkForm.startDate} onChange={e => setBulkForm({ ...bulkForm, startDate: e.target.value })} />
                                        <span>〜</span>
                                        <input type="date" className="form-input" required value={bulkForm.endDate} onChange={e => setBulkForm({ ...bulkForm, endDate: e.target.value })} />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">対象曜日</label>
                                    <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                                        {dayNames.map((day, ix) => (
                                            <label key={ix} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                <input type="checkbox" checked={bulkForm.days[ix]} onChange={e => setBulkForm({ ...bulkForm, days: { ...bulkForm.days, [ix]: e.target.checked } })} />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">対象時間帯</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                                        <input type="time" className="form-input" required value={bulkForm.startTime} onChange={e => setBulkForm({ ...bulkForm, startTime: e.target.value })} />
                                        <span>〜</span>
                                        <input type="time" className="form-input" required value={bulkForm.endTime} onChange={e => setBulkForm({ ...bulkForm, endTime: e.target.value })} />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">時間間隔（分）</label>
                                    <select className="form-input" value={bulkForm.interval} onChange={e => setBulkForm({ ...bulkForm, interval: e.target.value })}>
                                        <option value="15">15分間隔</option>
                                        <option value="30">30分間隔</option>
                                        <option value="60">60分間隔</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">適用するステータス</label>
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                        <label style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: bulkForm.status === 'open' ? 'rgba(74,124,89,0.1)' : '#fff', borderColor: bulkForm.status === 'open' ? 'var(--primary)' : 'var(--border)' }}>
                                            <input type="radio" name="bulk_status" value="open" checked={bulkForm.status === 'open'} onChange={() => setBulkForm({ ...bulkForm, status: 'open' })} />
                                            <span style={{ fontWeight: 600, color: '#4a7c59' }}>〇 開放</span>
                                        </label>
                                        <label style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: bulkForm.status === 'request' ? 'rgba(230,126,34,0.1)' : '#fff', borderColor: bulkForm.status === 'request' ? '#e67e22' : 'var(--border)' }}>
                                            <input type="radio" name="bulk_status" value="request" checked={bulkForm.status === 'request'} onChange={() => setBulkForm({ ...bulkForm, status: 'request' })} />
                                            <span style={{ fontWeight: 600, color: '#e67e22' }}>△ リクエスト制</span>
                                        </label>
                                        <label style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: bulkForm.status === 'closed' ? 'rgba(192,57,43,0.1)' : '#fff', borderColor: bulkForm.status === 'closed' ? '#c0392b' : 'var(--border)' }}>
                                            <input type="radio" name="bulk_status" value="closed" checked={bulkForm.status === 'closed'} onChange={() => setBulkForm({ ...bulkForm, status: 'closed' })} />
                                            <span style={{ fontWeight: 600, color: '#c0392b' }}>× 停止</span>
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-6)' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)} style={{ flex: 1 }}>キャンセル</button>
                                    <button type="submit" className="btn btn-primary" disabled={bulkSubmitting} style={{ flex: 1 }}>{bulkSubmitting ? '処理中...' : '適用する'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
