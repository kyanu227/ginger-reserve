import { buildReservationPreview } from './reservationPreview'

export function buildReservationPayload({
    form,
    menus = [],
    options = [],
    settings = {},
    resources = [],
    selectedDuration,
    visitCount = 0,
} = {}) {
    const preview = buildReservationPreview({ form, menus, options, settings, resources, selectedDuration, visitCount })

    return {
        ...form,
        menuId: preview.selectedMenu?.id || form?.menuId || '',
        options: preview.selectedOptions.map(option => option.id),
        time: preview.bathStartTime || form?.time || '',
        bathStartTime: preview.bathStartTime,
        bathEndTime: preview.bathEndTime,
        arrivalTime: preview.arrivalTime,
        endTime: preview.bathEndTime,
        totalDuration: preview.totalDuration,
        mainDuration: preview.mainDuration,
        totalPrice: preview.totalPrice,
        priceBreakdown: preview.breakdown,
        resourceUsages: preview.resourceUsages,
    }
}

