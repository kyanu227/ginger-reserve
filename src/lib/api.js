/**
 * Barrel file — re-exports all API functions for backward compatibility
 * All existing imports continue to work: import { getMenus } from '../lib/api'
 */

export { cacheGet, cacheSet, cacheDel } from './api/cache.js'
export { getCustomers, getCustomer, getCustomerReservations, searchCustomers, createCustomer, updateCustomer, linkReservation, unlinkReservation, findMatchingCustomer, incrementVisitCount, migrateCustomers, findDuplicates, mergeCustomers } from './api/customers.js'
export { IS_DEMO, DEMO_MENUS, DEMO_OPTIONS, DEMO_RESOURCES, DEMO_SETTINGS, DEMO_RESERVATIONS, DEMO_CUSTOMERS, generateDemoRanges, expandRangesToSlots } from './api/demo.js'
export { normalizePhone, formatPrice, formatDate, getStatusLabel, getStatusColor, getMenuName } from './api/formatters.js'
export { GAS_API_URL, _GAS_URL_ENV, _GAS_SECRET_ENV, callGas, buildCalendarEvents, buildLineMessage, sendLineNotification, saveLineToken, getLineTokenStatus, getLineBotInfo, sendConfirmationEmail } from './api/gas.js'
export { maybeInitializeData, batchWrite, getInitData } from './api/init.js'
export { getMenus, getOptions, updateMenus, updateOptionsData } from './api/menus.js'
export { getReservations, createReservation, updateReservation, cancelReservation, getBookedIntervals, checkRepeater } from './api/reservations.js'
export { getResources, updateResourcesData } from './api/resources.js'
export { getRanges, getSlots, updateSlots } from './api/slots.js'
export { getSystemSettings, updateSystemSettings } from './api/settings.js'
export { getStaff, addStaff, updateStaff } from './api/staff.js'
export { getStats } from './api/stats.js'
