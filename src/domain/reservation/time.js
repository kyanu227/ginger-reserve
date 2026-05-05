export function timeToMinutes(time) {
    if (!time || typeof time !== 'string') return 0
    const [hours, minutes] = time.split(':').map(Number)
    return (hours || 0) * 60 + (minutes || 0)
}

export function minutesToTime(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440
    const hours = Math.floor(normalized / 60)
    const mins = normalized % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function addMinutes(time, minutes) {
    return minutesToTime(timeToMinutes(time) + minutes)
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd
}

export function toLocalDateTimeString(date, minutes) {
    const dayOffset = Math.floor(minutes / 1440)
    const localMinutes = ((minutes % 1440) + 1440) % 1440
    const base = new Date(`${date}T00:00:00`)
    base.setDate(base.getDate() + dayOffset)
    const datePart = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
    return `${datePart}T${minutesToTime(localMinutes)}:00+09:00`
}

export function usageStartMinutes(usage) {
    if (Number.isFinite(usage?.startMin)) return usage.startMin
    return timeToMinutes(usage?.startTime || usage?.startAt?.slice(11, 16) || '00:00')
}

export function usageEndMinutes(usage) {
    if (Number.isFinite(usage?.endMin)) return usage.endMin
    return timeToMinutes(usage?.endTime || usage?.endAt?.slice(11, 16) || '00:00')
}

