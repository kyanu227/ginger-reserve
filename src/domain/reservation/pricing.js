import { isEligibleByVisitCount, resolveEligibleVariants } from './eligibility'

export function resolveSelectedVariant(menu, visitCount = 0, variantId = '') {
    if (!menu?.variants?.length) return null
    const variants = resolveEligibleVariants(menu, visitCount)
    return variants.find(variant => variant.id === variantId) || variants[0] || null
}

export function getMenuUnitPrice(menu, visitCount = 0, variantId = '') {
    const variant = resolveSelectedVariant(menu, visitCount, variantId)
    if (variant) return Number(variant.price || 0)
    if (!isEligibleByVisitCount(menu, visitCount)) return 0
    return Number(menu?.price || 0)
}

export function calculateReservationPrice({
    menu,
    options = [],
    guests = 1,
    visitCount = 0,
    variantId = '',
} = {}) {
    const guestCount = Number(guests || 1)
    const menuUnitPrice = getMenuUnitPrice(menu, visitCount, variantId)
    const optionTotal = options.reduce((sum, option) => sum + Number(option?.price || 0) * guestCount, 0)
    const totalPrice = menuUnitPrice * guestCount + optionTotal

    return {
        menuUnitPrice,
        optionTotal,
        totalPrice,
        variant: resolveSelectedVariant(menu, visitCount, variantId),
        breakdown: [
            { type: 'menu', label: menu?.name || '', unitPrice: menuUnitPrice, quantity: guestCount, amount: menuUnitPrice * guestCount },
            ...options.map(option => ({
                type: 'option',
                label: option?.name || '',
                unitPrice: Number(option?.price || 0),
                quantity: guestCount,
                amount: Number(option?.price || 0) * guestCount,
            })),
        ],
    }
}

