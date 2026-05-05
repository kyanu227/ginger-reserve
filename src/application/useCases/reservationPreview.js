import {
    buildResourceUsages,
    calculateReservationPrice,
    fitsAvailabilityWindows,
    normalizeResources,
} from '../../domain/reservation'

export function buildReservationPreview({
    form,
    menus = [],
    options = [],
    settings = {},
    resources = [],
    selectedDuration,
    visitCount = 0,
    ranges = [],
} = {}) {
    const selectedMenu = menus.find(menu => menu.id === form?.menuId) || null
    const selectedOptions = options.filter(option => (form?.selectedOptions || form?.options || []).includes(option.id))
    const resourcePlan = buildResourceUsages({
        date: form?.date,
        bathStartTime: form?.time,
        guests: form?.guests || 1,
        menu: selectedMenu,
        menus,
        options: selectedOptions,
        selectedDuration,
        massageDuration1: form?.massageDuration1 || 0,
        massageDuration2: form?.massageDuration2 || 0,
    })
    const price = calculateReservationPrice({
        menu: selectedMenu,
        options: selectedOptions,
        guests: form?.guests || 1,
        visitCount,
        variantId: form?.variantId,
    })
    const activeResources = normalizeResources(resources, settings)
    const fit = ranges.length ? fitsAvailabilityWindows(resourcePlan.resourceUsages, ranges) : { ok: true }

    return {
        selectedMenu,
        selectedOptions,
        resources: activeResources,
        ...resourcePlan,
        ...price,
        availability: fit,
    }
}

