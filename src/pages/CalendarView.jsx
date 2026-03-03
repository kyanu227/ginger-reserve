import { useState, useEffect, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getInitData, formatPrice, getStatusLabel } from '../lib/api'

export default function CalendarView() {
    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const d = new Date()
            const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const [res, initData] = await Promise.all([getReservations(), getInitData(currentMonth)])
            setReservations(res)
            setMenus(initData.menus || [])
            setLoading(false)
        }
        load()
    }, [])

    const colorMap = {
        'enzyme-first': '#8B6914',
        'enzyme-regular': '#a0522d',
        'enzyme-bring': '#6a9f5b',
        'yomogi': '#4a7c59'
    }

    const events = useMemo(() => {
        return reservations
            .filter(r => r.status !== 'cancelled')
            .map(r => {
                const menu = menus.find(m => m.id === r.menuId)
                const duration = menu ? menu.duration * (r.guests || 1) : 30
                const start = `${r.date}T${r.time}:00`
                const [h, m2] = r.time.split(':').map(Number)
                const endMin = h * 60 + m2 + duration
                const end = `${r.date}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`

                return {
                    id: r.id,
                    title: `${r.lastName}${r.firstName} - ${menu?.name || ''}`,
                    start,
                    end,
                    backgroundColor: colorMap[r.menuId] || '#8B6914',
                    borderColor: 'transparent',
                    extendedProps: { reservation: r, menu }
                }
            })
    }, [reservations, menus])

    function handleEventClick(info) {
        const { reservation, menu } = info.event.extendedProps
        setSelectedEvent({ reservation, menu })
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                <h1 className="admin-page-title">📅 予約カレンダー</h1>
                <p className="admin-page-desc">月・週・日の表示を切り替えて予約状況を確認できます</p>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 'var(--sp-6)', marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
                    {menus.filter(m => m.active).map(menu => (
                        <div key={menu.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, background: colorMap[menu.id] || '#8B6914' }}></div>
                            <span style={{ fontSize: '0.9rem' }}>{menu.icon} {menu.name}</span>
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    <div className="card fc-container">
                        <FullCalendar
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridWeek,timeGridDay'
                            }}
                            locale="ja"
                            events={events}
                            eventClick={handleEventClick}
                            height="auto"
                            buttonText={{
                                today: '今日',
                                month: '月',
                                week: '週',
                                day: '日'
                            }}
                            slotMinTime="09:00:00"
                            slotMaxTime="19:00:00"
                            allDaySlot={false}
                        />
                    </div>
                )}

                {/* Event Detail Modal */}
                {selectedEvent && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }} onClick={() => setSelectedEvent(null)}>
                        <div className="card" style={{ maxWidth: 450, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                                <h2 style={{ fontSize: '1.1rem' }}>予約詳細</h2>
                                <button onClick={() => setSelectedEvent(null)}
                                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                            </div>

                            <table className="confirmation-table" style={{ width: '100%' }}>
                                <tbody>
                                    <tr><th>予約番号</th><td>{selectedEvent.reservation.id}</td></tr>
                                    <tr><th>お客様</th><td>{selectedEvent.reservation.lastName} {selectedEvent.reservation.firstName}</td></tr>
                                    <tr><th>電話</th><td>{selectedEvent.reservation.phone}</td></tr>
                                    <tr><th>コース</th><td>{selectedEvent.menu?.icon} {selectedEvent.menu?.name}</td></tr>
                                    <tr><th>日時</th><td>{selectedEvent.reservation.date} {selectedEvent.reservation.time}〜</td></tr>
                                    <tr><th>人数</th><td>{selectedEvent.reservation.guests}名</td></tr>
                                    <tr><th>合計</th><td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(selectedEvent.reservation.totalPrice)}</td></tr>
                                    <tr><th>ステータス</th><td>{getStatusLabel(selectedEvent.reservation.status)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
