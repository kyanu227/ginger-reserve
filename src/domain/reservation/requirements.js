import { normalizeMenu, normalizeOption } from './resources'
import { DURATION_SOURCES, RESOURCE_PHASES, RESOURCE_UNIT_SOURCES } from './types'
import { minutesToTime, timeToMinutes, toLocalDateTimeString } from './time'

function getRequirementDuration(requirement, fallbackDuration, selectedDuration) {
    if (requirement.durationSource === DURATION_SOURCES.SELECTED_DURATION) {
        return Number(selectedDuration || fallbackDuration || 0)
    }
    if (selectedDuration && (requirement.phase || RESOURCE_PHASES.MAIN) === RESOURCE_PHASES.MAIN) {
        return Number(selectedDuration)
    }
    return Number(requirement.durationMinutes || fallbackDuration || 0)
}

function getRequirementUnits(requirement, guests) {
    if (requirement.units === RESOURCE_UNIT_SOURCES.GUESTS || requirement.units === 'guests') return Number(guests || 1)
    return Number(requirement.capacityUnits || requirement.units || 1)
}

function buildUsage({ date, resourceId, startMin, endMin, units, phase, sourceType, sourceId, guestIndex }) {
    return {
        resourceId,
        phase,
        sourceType,
        sourceId,
        startMin,
        endMin,
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(endMin),
        startAt: toLocalDateTimeString(date, startMin),
        endAt: toLocalDateTimeString(date, endMin),
        units,
        ...(guestIndex ? { guestIndex } : {}),
    }
}

function selectedDurationsPerGuest({ option, guests, massageDuration1 = 0, massageDuration2 = 0, optionDurations = {} }) {
    const configured = optionDurations[option.id]
    if (Array.isArray(configured)) return configured.slice(0, guests)
    if (Number.isFinite(configured)) return Array.from({ length: guests }, () => configured)
    if (option.id === 'massage-chair') {
        return guests === 1
            ? [Number(massageDuration1 || 0)]
            : [Number(massageDuration1 || 0), Number(massageDuration2 || 0)]
    }
    const fallback = Number(option.selectedDuration || option.selectableDurations?.[0] || option.durations?.[0] || 0)
    return Array.from({ length: guests }, () => fallback)
}

export function buildResourceUsages({
    date,
    bathStartTime,
    time,
    guests = 1,
    menu,
    menus = [],
    options = [],
    selectedDuration,
    massageDuration1 = 0,
    massageDuration2 = 0,
    optionDurations = {},
} = {}) {
    if (!date || !(bathStartTime || time) || !menu) {
        return {
            resourceUsages: [],
            arrivalTime: bathStartTime || time || '',
            bathStartTime: bathStartTime || time || '',
            bathEndTime: bathStartTime || time || '',
            totalDuration: 0,
            mainDuration: 0,
        }
    }

    const normalizedMenu = normalizeMenu(menu, menus)
    const normalizedOptions = options.map(normalizeOption).filter(Boolean)
    const bathStartMin = timeToMinutes(bathStartTime || time)
    const resourceUsages = []

    normalizedMenu.resourceRequirements.forEach(requirement => {
        const duration = getRequirementDuration(requirement, normalizedMenu.durationMinutes, selectedDuration)
        const endMin = bathStartMin + duration
        resourceUsages.push(buildUsage({
            date,
            resourceId: requirement.resourceId,
            startMin: bathStartMin,
            endMin,
            units: getRequirementUnits(requirement, guests),
            phase: requirement.phase || RESOURCE_PHASES.MAIN,
            sourceType: 'menu',
            sourceId: normalizedMenu.id,
        }))
    })

    normalizedOptions.forEach(option => {
        option.resourceRequirements.forEach(requirement => {
            const phase = requirement.phase || option.timing || RESOURCE_PHASES.MAIN

            if (phase === RESOURCE_PHASES.BEFORE_MAIN && (option.sequentialPerGuest || requirement.durationSource === DURATION_SOURCES.SELECTED_DURATION_PER_GUEST)) {
                const durations = selectedDurationsPerGuest({ option, guests, massageDuration1, massageDuration2, optionDurations })
                const totalOptionDuration = durations.reduce((sum, duration) => sum + Number(duration || 0), 0)
                let cursor = bathStartMin - totalOptionDuration

                durations.forEach((duration, index) => {
                    const minutes = Number(duration || 0)
                    if (minutes <= 0) return
                    const startMin = cursor
                    const endMin = cursor + minutes
                    cursor = endMin
                    resourceUsages.push(buildUsage({
                        date,
                        resourceId: requirement.resourceId,
                        startMin,
                        endMin,
                        units: Number(requirement.capacityUnits || 1),
                        phase,
                        sourceType: 'option',
                        sourceId: option.id,
                        guestIndex: index + 1,
                    }))
                })
                return
            }

            const duration = getRequirementDuration(requirement, option.durationMinutes, option.selectedDuration)
            if (duration <= 0) return
            const startMin = phase === RESOURCE_PHASES.BEFORE_MAIN ? bathStartMin - duration : bathStartMin
            const endMin = startMin + duration
            resourceUsages.push(buildUsage({
                date,
                resourceId: requirement.resourceId,
                startMin,
                endMin,
                units: getRequirementUnits(requirement, guests),
                phase,
                sourceType: 'option',
                sourceId: option.id,
            }))
        })
    })

    const starts = resourceUsages.map(usage => usage.startMin)
    const ends = resourceUsages.map(usage => usage.endMin)
    const arrivalMin = starts.length ? Math.min(...starts) : bathStartMin
    const bathEndMin = resourceUsages
        .filter(usage => usage.phase === RESOURCE_PHASES.MAIN)
        .reduce((max, usage) => Math.max(max, usage.endMin), bathStartMin)
    const maxEndMin = ends.length ? Math.max(...ends) : bathEndMin

    return {
        resourceUsages: resourceUsages.sort((a, b) => a.startMin - b.startMin || a.resourceId.localeCompare(b.resourceId)),
        arrivalTime: minutesToTime(arrivalMin),
        bathStartTime: minutesToTime(bathStartMin),
        bathEndTime: minutesToTime(bathEndMin),
        totalDuration: maxEndMin - arrivalMin,
        mainDuration: bathEndMin - bathStartMin,
    }
}
