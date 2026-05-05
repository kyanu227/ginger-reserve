export function resolveMinVisits(menuOrVariant) {
    if (menuOrVariant?.minVisits !== undefined) return menuOrVariant.minVisits
    if (menuOrVariant?.visibility === 'firstTime') return -1
    if (menuOrVariant?.visibility === 'repeater') return 1
    return 0
}

export function isEligibleByVisitCount(menuOrVariant, visitCount = 0) {
    const minVisits = resolveMinVisits(menuOrVariant)
    if (minVisits === -1) return visitCount === 0
    if (minVisits >= 1) return visitCount >= minVisits
    return true
}

export function resolveEligibleVariants(menu, visitCount = 0) {
    const variants = menu?.variants || []
    return variants.filter(variant => variant.active !== false && isEligibleByVisitCount(variant, visitCount))
}

export function getBookableMenusForCustomer(menus = [], visitCount = 0) {
    return menus.filter(menu => {
        if (menu.isCategory) return menu.active !== false
        if (menu.active === false) return false
        if (menu.variants?.length) return resolveEligibleVariants(menu, visitCount).length > 0
        return isEligibleByVisitCount(menu, visitCount)
    })
}

