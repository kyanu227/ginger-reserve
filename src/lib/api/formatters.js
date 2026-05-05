/**
 * フォーマット・ユーティリティ関数
 */

export function normalizePhone(phone) {
    if (!phone) return ''
    let digits = String(phone).replace(/[^0-9]/g, '')
    if (digits.indexOf('81') === 0 && digits.length > 10) digits = '0' + digits.substring(2)
    return digits
}

export function formatPrice(price) {
    return `¥${Number(price).toLocaleString()}`
}

export function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export function getStatusLabel(status) {
    const map = { confirmed: '確定', pending: '保留中', cancelled: 'キャンセル', completed: '来店済み' }
    return map[status] || status
}

export function getStatusColor(status) {
    const map = { confirmed: '#4a7c59', pending: '#c4a35a', cancelled: '#c0392b', completed: '#2c3e50' }
    return map[status] || '#666'
}

/**
 * メニューIDから表示名を取得（管理画面の共通ヘルパー）
 * @param {string} menuId
 * @param {Array} menus - getMenus() の結果
 * @param {{ withIcon?: boolean }} opts - withIcon=true でアイコン付き
 * @returns {string}
 */
export function getMenuName(menuId, menus, opts = {}) {
    const menu = menus.find(m => m.id === menuId)
    if (!menu) return menuId
    return opts.withIcon ? `${menu.icon || ''} ${menu.name}`.trim() : menu.name
}
