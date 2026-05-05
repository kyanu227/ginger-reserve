/**
 * 設定定数
 * ADMIN_EMAILS: 初回ログイン時に自動で admin ロールが付与されるメールアドレス
 * 変更時は firestore.rules の isAdmin() 内メールも合わせて更新すること
 */
export const ADMIN_EMAILS = [
    'okmarineclub@gmail.com',
    'kyanyuki0227@gmail.com',
]
