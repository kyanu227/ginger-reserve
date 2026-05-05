import {
    checkResourceCapacity,
    fitsAvailabilityWindows,
    normalizeExistingResourceUsages,
    normalizeResources,
} from '../../domain/reservation'
import { buildReservationPreview } from './reservationPreview'

export function checkReservationPreviewAvailability({
    form,
    menus = [],
    options = [],
    settings = {},
    resources = [],
    ranges = [],
    reservations = [],
    selectedDuration,
    visitCount = 0,
} = {}) {
    const preview = buildReservationPreview({ form, menus, options, settings, resources, ranges, selectedDuration, visitCount })
    const existingUsages = normalizeExistingResourceUsages(reservations, { menus, options, date: form?.date })
    const fit = fitsAvailabilityWindows(preview.resourceUsages, ranges)
    if (!fit.ok) return { ...fit, preview }

    const capacity = checkResourceCapacity(preview.resourceUsages, existingUsages, normalizeResources(resources, settings))
    return { ...capacity, preview }
}

