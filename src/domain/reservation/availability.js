import { buildResourceUsages } from './requirements'
import { getResourceCapacity, normalizeResources } from './resources'
import { minutesToTime, rangesOverlap, timeToMinutes, usageEndMinutes, usageStartMinutes } from './time'

export function normalizeExistingResourceUsages(reservations = [], { menus = [], options = [], date = '' } = {}) {
    return reservations.flatMap(reservation => {
        if (reservation.resourceUsages?.length) return reservation.resourceUsages
        const menu = menus.find(candidate => candidate.id === reservation.menuId)
        const selectedOptions = options.filter(option => (reservation.options || []).includes(option.id))
        return buildResourceUsages({
            date: reservation.date || date,
            bathStartTime: reservation.time || (Number.isFinite(reservation.startMin) ? minutesToTime(reservation.startMin) : ''),
            guests: reservation.guests || 1,
            menu,
            menus,
            options: selectedOptions,
            massageDuration1: reservation.massageDuration1 || 0,
            massageDuration2: reservation.massageDuration2 || 0,
        }).resourceUsages
    })
}

export function checkResourceCapacity(candidateUsages = [], existingUsages = [], resources = []) {
    const activeResources = normalizeResources(resources)

    for (const candidate of candidateUsages) {
        const resourceId = candidate.resourceId
        const candidateStart = usageStartMinutes(candidate)
        const candidateEnd = usageEndMinutes(candidate)
        const overlappingUnits = existingUsages
            .filter(usage => usage.resourceId === resourceId)
            .filter(usage => rangesOverlap(candidateStart, candidateEnd, usageStartMinutes(usage), usageEndMinutes(usage)))
            .reduce((sum, usage) => sum + Number(usage.units || 1), 0)
        const requestedUnits = overlappingUnits + Number(candidate.units || 1)
        const capacity = getResourceCapacity(activeResources, resourceId)

        if (requestedUnits > capacity) {
            return {
                ok: false,
                resourceId,
                capacity,
                requestedUnits,
                message: `${resourceId} の定員を超えています`,
            }
        }
    }

    return { ok: true }
}

export function fitsAvailabilityWindows(resourceUsages = [], windows = []) {
    if (!resourceUsages.length) return { ok: false, message: 'リソース使用時間が生成されていません' }
    const openWindows = windows.filter(window => window.status === 'open' || window.status === 'request' || window.open === true || window.open === 'request')
    if (!openWindows.length) return { ok: false, message: '開放されている予約枠がありません' }

    const failingUsage = resourceUsages.find(usage => {
        const start = usageStartMinutes(usage)
        const end = usageEndMinutes(usage)
        return !openWindows.some(window => {
            const windowStart = timeToMinutes(window.startTime || window.time)
            const windowEnd = window.endTime ? timeToMinutes(window.endTime) : windowStart + 30
            return windowStart <= start && end <= windowEnd
        })
    })

    if (failingUsage) {
        return {
            ok: false,
            resourceId: failingUsage.resourceId,
            message: '選択内容が開放枠に収まっていません',
        }
    }

    return { ok: true }
}
