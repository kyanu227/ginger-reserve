/**
 * シンプルなメモリキャッシュ（TTL付き）
 * menus/options/settings のような準静的データをセッション中にキャッシュし
 * Firestore 読み取り数を大幅削減する
 */

const _cache = {}
export const cacheGet = key => {
    const e = _cache[key]
    if (!e) return undefined
    if (Date.now() > e.exp) { delete _cache[key]; return undefined }
    return e.val
}
// ttlMs = Infinity でセッション中は期限なし（明示的 cacheDel で無効化）
export const cacheSet = (key, val, ttlMs = Infinity) => { _cache[key] = { val, exp: Date.now() + ttlMs } }
export const cacheDel = (...keys) => keys.forEach(k => delete _cache[k])
