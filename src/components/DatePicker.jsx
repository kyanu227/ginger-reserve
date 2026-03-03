import { useState, useMemo } from 'react'

export default function DatePicker({ selected, onSelect, onMonthChange, availableDates, closedDays = [0] }) {
    const [currentDate, setCurrentDate] = useState(() => selected ? new Date(selected) : new Date())

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const result = []

        // Padding for first week
        for (let i = 0; i < firstDay; i++) result.push(null)

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d)
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const isPast = date < today
            const isClosed = closedDays.includes(date.getDay())
            const hasSlots = availableDates ? availableDates.has(dateStr) : true
            const isDisabled = isPast || isClosed || !hasSlots
            const dayOfWeek = date.getDay()

            result.push({
                day: d,
                date: dateStr,
                isToday: date.toDateString() === today.toDateString(),
                isSelected: dateStr === selected,
                isPast,
                isClosed,
                isDisabled,
                hasSlots,
                isSunday: dayOfWeek === 0,
                isSaturday: dayOfWeek === 6,
            })
        }

        return result
    }, [year, month, selected, availableDates, closedDays])

    function navigate(delta) {
        const newDate = new Date(year, month + delta, 1)
        setCurrentDate(newDate)
        if (onMonthChange) {
            onMonthChange(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
        }
    }

    const dayNames = ['日', '月', '火', '水', '木', '金', '土']

    return (
        <div className="datepicker">
            <div className="datepicker-header">
                <button className="datepicker-nav" onClick={() => navigate(-1)}>◀</button>
                <span className="datepicker-title">{year}年{month + 1}月</span>
                <button className="datepicker-nav" onClick={() => navigate(1)}>▶</button>
            </div>

            <div className="datepicker-grid">
                {dayNames.map((name, i) => (
                    <div key={name} className={`datepicker-weekday ${i === 0 ? 'sunday' : ''} ${i === 6 ? 'saturday' : ''}`}>
                        {name}
                    </div>
                ))}

                {days.map((d, i) => (
                    d ? (
                        <button
                            key={i}
                            className={[
                                'datepicker-day',
                                d.isSelected ? 'selected' : '',
                                d.isDisabled ? '' : d.hasSlots ? 'available' : '',
                                d.isSunday ? 'sunday' : '',
                                d.isSaturday ? 'saturday' : '',
                            ].join(' ')}
                            disabled={d.isDisabled}
                            onClick={() => !d.isDisabled && onSelect(d.date)}
                        >
                            {d.day}
                        </button>
                    ) : <div key={i} />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center', marginTop: 'var(--sp-3)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>● 空きあり</span>
                <span style={{ opacity: 0.4 }}>— 予約不可</span>
            </div>
        </div>
    )
}
