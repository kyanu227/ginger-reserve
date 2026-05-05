import {
    DEFAULT_RESOURCES,
    DURATION_SOURCES,
    RESOURCE_IDS,
    RESOURCE_PHASES,
    RESOURCE_UNIT_SOURCES,
} from './types'

function lowerText(value) {
    return String(value || '').toLowerCase()
}

export function findParentMenu(menu, menus = []) {
    return menu?.parentId ? menus.find(candidate => candidate.id === menu.parentId) || null : null
}

export function inferMenuCategory(menu, menus = []) {
    const parent = findParentMenu(menu, menus)
    const text = [
        menu?.id,
        menu?.category,
        menu?.categoryKey,
        menu?.name,
        parent?.id,
        parent?.category,
        parent?.categoryKey,
        parent?.name,
    ].map(lowerText).join(' ')

    if (text.includes('yomogi') || text.includes('よもぎ')) return 'yomogi'
    if (text.includes('enzyme') || text.includes('酵素')) return 'enzyme'
    return menu?.categoryKey || menu?.category || 'general'
}

export function inferMenuResourceId(menu, menus = []) {
    const category = inferMenuCategory(menu, menus)
    if (category === 'yomogi') return RESOURCE_IDS.YOMOGI_ROOM
    if (category === 'enzyme') return RESOURCE_IDS.ENZYME_BATH
    return menu?.resourceId || RESOURCE_IDS.ENZYME_BATH
}

export function normalizeMenu(menu, menus = []) {
    if (!menu) return null
    if (menu.isCategory) return { ...menu, resourceRequirements: [] }

    const durationMinutes = Number(menu.durationMinutes || menu.duration || menu.durations?.[0] || 20)
    const resourceRequirements = menu.resourceRequirements?.length
        ? menu.resourceRequirements
        : [{
            resourceId: inferMenuResourceId(menu, menus),
            phase: RESOURCE_PHASES.MAIN,
            durationMinutes,
            units: RESOURCE_UNIT_SOURCES.GUESTS,
        }]

    return {
        ...menu,
        categoryKey: menu.categoryKey || inferMenuCategory(menu, menus),
        durationMinutes,
        resourceRequirements,
    }
}

export function normalizeOption(option) {
    if (!option) return null

    const isMassageChair = option.id === 'massage-chair' || option.resourceId === RESOURCE_IDS.MASSAGE_CHAIR
    const selectableDurations = option.selectableDurations || option.durations || []
    const resourceRequirements = option.resourceRequirements?.length
        ? option.resourceRequirements
        : (option.isTimedResource || isMassageChair)
            ? [{
                resourceId: option.resourceId || RESOURCE_IDS.MASSAGE_CHAIR,
                phase: option.timing || RESOURCE_PHASES.BEFORE_MAIN,
                capacityUnits: option.capacityUnits || 1,
                durationSource: DURATION_SOURCES.SELECTED_DURATION_PER_GUEST,
            }]
            : []

    return {
        ...option,
        timing: option.timing || (isMassageChair ? RESOURCE_PHASES.BEFORE_MAIN : RESOURCE_PHASES.MAIN),
        selectableDurations,
        sequentialPerGuest: option.sequentialPerGuest ?? !!isMassageChair,
        resourceRequirements,
    }
}

export function normalizeResources(resources = [], settings = {}) {
    const byId = new Map(DEFAULT_RESOURCES.map(resource => [resource.id, { ...resource }]))
    resources.forEach(resource => {
        if (!resource?.id) return
        byId.set(resource.id, { ...(byId.get(resource.id) || {}), ...resource })
    })

    const maxConcurrent = Number(settings?.['最大同時人数'])
    if (Number.isFinite(maxConcurrent) && maxConcurrent > 0) {
        const enzymeBath = byId.get(RESOURCE_IDS.ENZYME_BATH)
        byId.set(RESOURCE_IDS.ENZYME_BATH, { ...enzymeBath, capacity: maxConcurrent })
    }

    return [...byId.values()]
        .filter(resource => resource.active !== false)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

export function getResourceCapacity(resources, resourceId) {
    return resources.find(resource => resource.id === resourceId)?.capacity || 1
}

export function optionMatchesMenu(option, menu, menus = []) {
    const normalizedOption = normalizeOption(option)
    const normalizedMenu = normalizeMenu(menu, menus)
    if (!normalizedOption || !normalizedMenu) return false
    const eligible = normalizedOption.eligibleMenuCategories || normalizedOption.eligibleCategories
    if (!eligible?.length) return true
    return eligible.includes(normalizedMenu.categoryKey)
}

