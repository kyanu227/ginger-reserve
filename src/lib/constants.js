/**
 * プロジェクト共通定数・ユーティリティ
 * 複数ファイルで重複していた値をここに集約
 */

// 曜日ラベル（日本語）
export const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// オプションID
export const OPTION_IDS = {
    MASSAGE_CHAIR: 'massage-chair',
}

// オプション制約値
export const CONSTRAINTS = {
    ENZYME_BEFORE: 'enzyme-before',
}

// 設定キー（Firestore settings コレクション）
export const SETTINGS_KEYS = {
    MAX_CONCURRENT: '最大同時人数',
}

// 時刻ユーティリティ
export const timeToMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const minToTime = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
