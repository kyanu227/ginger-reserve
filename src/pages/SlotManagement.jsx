/**
 * 予約枠管理（管理画面）
 * 連続ペイント + エッジドラッグで営業時間を設定。10分粒度でスナップ
 * PX_PER_MIN=1.5 で 10分=15px のタイムライン描画
 * 関連: api/slots.js, constants.js（DAY_LABELS）
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getRanges, updateSlots, getSystemSettings, updateSystemSettings } from '../lib/api'
import { DAY_LABELS } from '../lib/constants'

const PX_PER_MIN = 1.5   // タイムラインのピクセル/分比率
const CORNER_H   = 52    // 日付ヘッダー高さ（px）
const SNAP       = 10    // スナップ粒度（分）
const EDGE_THRESH = 20   // エッジ検出閾値（px）— 広めでタッチ操作しやすく

// ── ユーティリティ ──
const norm    = o => o === true || o === 'open' ? 'open' : o === 'request' ? 'request' : 'closed'
const t2m     = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const m2t     = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (ds, n) => { const d = new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return fmtDate(d) }
const genWeek = s => Array.from({ length: 7 }, (_, i) => addDays(s, i))
const snap10  = m => Math.round(m / SNAP) * SNAP
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 10分刻みの時刻配列を生成（m < em → endTime 自体は含まない）
const genTimes = (s, e) => {
    const a = [], sm = t2m(s), em = t2m(e)
    for (let m = sm; m < em; m += SNAP) a.push(m2t(m))
    return a
}

// 隣接する同ステータスのスロットを連続ブロックに統合（10分粒度）
function computeRuns(date, bizTimes, viewMap) {
    const runs = []
    let i = 0
    while (i < bizTimes.length) {
        const status = norm((viewMap[`${date}_${bizTimes[i]}`] || {}).open) || 'empty'
        let j = i + 1
        while (j < bizTimes.length &&
               (norm((viewMap[`${date}_${bizTimes[j]}`] || {}).open) || 'empty') === status) j++
        runs.push({ startTime: bizTimes[i], count: j - i, status })
        i = j
    }
    return runs
}

// mergedRuns から date のアクティブブロック一覧（ピクセル位置付き）を取得
function extractBlocks(date, mergedRuns, bizStartMin) {
    return (mergedRuns[date] || [])
        .filter(r => r.status !== 'empty' && r.status !== 'closed')
        .map(r => {
            const startMin = t2m(r.startTime)
            const endMin   = startMin + r.count * SNAP
            return {
                startMin, endMin, status: r.status,
                topPx:    (startMin - bizStartMin) * PX_PER_MIN,
                bottomPx: (endMin   - bizStartMin) * PX_PER_MIN,
            }
        })
}

// ── CSS ──
const CSS = `
/* ── 全体レイアウト ──────────────────────────────── */
.sm2-page{display:flex;flex-direction:column;height:100%;overflow:hidden}
.sm2-topbar{display:flex;align-items:center;gap:8px;padding:8px 0 6px;flex-wrap:wrap;flex-shrink:0}
.sm2-title{font-size:17px;font-weight:700;color:#463C38;white-space:nowrap}
.sm2-week-lbl{font-size:13px;font-weight:600;color:#6B5F59;white-space:nowrap}
.sm2-controls{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;position:relative}
.sm2-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:none;white-space:nowrap;transition:background .12s}
.sm2-btn-ghost{background:#f5f4ef;color:#463C38;border:1px solid #e0dbd5}
.sm2-btn-ghost:hover{background:#ece9e2}
.sm2-btn-primary{background:#3A5F56;color:#fff;border:none}
.sm2-btn-primary:hover{background:#2d4a43}
/* ── 営業時間ポップオーバー ──────────────────────── */
.sm2-biz-trigger{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:#f8f7f3;border:1px solid #e8e4de;border-radius:6px;font-size:12px;font-weight:600;color:#463C38;cursor:pointer;transition:background .12s}
.sm2-biz-trigger:hover{background:#ece9e2}
.sm2-biz-popover{position:absolute;top:calc(100% + 6px);right:0;z-index:500;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);padding:16px;min-width:260px}
.sm2-biz-popover label{display:block;font-size:12px;font-weight:600;color:#6B5F59;margin-bottom:4px}
.sm2-biz-popover input[type="time"]{width:100%;padding:8px 10px;border:1px solid #e0dbd5;border-radius:6px;font-size:14px;font-weight:600;color:#463C38}
/* ── ペイントカラーセレクター ──────────────────── */
.sm2-paint-bar{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
.sm2-paint-label{font-size:11px;font-weight:600;color:#9E9490;margin-right:2px}
.sm2-paint-btn{padding:4px 10px;border-radius:6px;border:2px solid transparent;cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;background:#f5f4ef;color:#6B5F59;transition:all .12s}
.sm2-paint-btn.active{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.sm2-paint-swatch{width:10px;height:10px;border-radius:2px;flex-shrink:0}
/* ── ステータスバー ──────────────────────────────── */
.sm2-statusbar{display:flex;align-items:center;gap:10px;padding:0 0 5px;font-size:12px;color:#6B5F59;flex-shrink:0;flex-wrap:wrap}
.sm2-stat{display:flex;align-items:center;gap:4px}
.sm2-dot{width:8px;height:8px;border-radius:2px;display:inline-block;flex-shrink:0}
.sm2-saving{color:#2196F3;font-weight:600;font-size:12px}
.sm2-hint{color:#bbb;font-size:11px;margin-left:auto}
.sm2-err{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#FFF3F0;border:1px solid #FFCDD2;border-radius:6px;color:#B71C1C;font-size:12px;flex-shrink:0;margin-bottom:4px}
.sm2-err-x{margin-left:auto;background:none;border:none;cursor:pointer;color:#B71C1C;font-size:16px;line-height:1}
/* ── スクロールコンテナ ──────────────────────────── */
.sm2-scroll{flex:1;min-height:0;overflow:auto;position:relative;border:1px solid #e8e4de;border-radius:8px;cursor:crosshair;-webkit-user-select:none;user-select:none}
.sm2-inner{display:flex;width:max-content;min-width:100%}
/* ── 左カラム：時間軸（sticky left, 最前面 z-index:300） ── */
.sm2-time-col{position:sticky;left:0;z-index:300;width:56px;flex-shrink:0;background:#faf9f6;box-shadow:2px 0 8px rgba(0,0,0,.10)}
.sm2-corner{height:52px;border-bottom:2px solid rgba(0,0,0,.08);position:sticky;top:0;z-index:400;background:#faf9f6;display:flex;align-items:center;justify-content:center}
.sm2-corner .corner-month{font-size:13px;color:#463C38;font-weight:800}
.sm2-time-marks{position:relative}
/* 時間ラベル：視認性重視（大きめ・高コントラスト・solid背景） */
.sm2-hour-label{position:absolute;left:2px;right:2px;text-align:right;font-size:12px;font-weight:700;color:#6B5F59;white-space:nowrap;transform:translateY(-50%);pointer-events:none;padding:2px 4px;border-radius:3px;background:#faf9f6;z-index:2;transition:color .1s,font-weight .1s,background .1s,box-shadow .1s}
/* 時間ラベル：ポップアウト強調（ドラッグ中） */
.sm2-hour-label.sel{color:#1565C0!important;font-weight:900!important;background:rgba(33,150,243,.22)!important;box-shadow:0 1px 4px rgba(33,150,243,.3)!important}
/* 時間範囲バー */
.sm2-time-bar{position:absolute;left:0;right:0;display:none;background:rgba(33,150,243,.14);border-left:4px solid rgba(33,150,243,.7);border-radius:0 3px 3px 0;pointer-events:none}
.sm2-time-tip{position:absolute;right:0;background:#1565C0;color:#fff;font-size:11px;font-weight:700;padding:2px 5px;border-radius:0 3px 3px 0;line-height:1.5;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.sm2-time-tip-start{top:-1px}.sm2-time-tip-end{bottom:-1px}
/* ── ビジュアルブロック（連続塗り・エッジ付き） ── */
.sm2-vblock{position:absolute;left:1px;right:1px;border-radius:3px;transition:opacity .1s;box-shadow:inset 0 2px 0 rgba(255,255,255,.25),inset 0 -2px 0 rgba(0,0,0,.08)}
.sm2-vblock.open{background:#66BB6A}
.sm2-vblock.request{background:#FFA726}
.sm2-vblock.closed,.sm2-vblock.empty{background:#E8E5DF}
.sm2-vblock.past{opacity:.25}
/* ── 右カラム：日付ヘッダー + タイムライン ──────── */
.sm2-main-col{flex:1;min-width:0}
.sm2-date-row{position:sticky;top:0;z-index:150;display:flex;height:52px;background:#faf9f6;border-bottom:2px solid rgba(0,0,0,.08)}
.sm2-date-arrow{width:36px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:#999;transition:background .12s,color .12s;user-select:none;border:none;background:transparent}
.sm2-date-arrow:hover{background:#f0ede8;color:#463C38}
.sm2-th-date{flex:1;min-width:72px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 2px;user-select:none;transition:background .15s}
.sm2-th-date .d-mth{font-size:9px;color:#bbb;font-weight:600;height:12px;display:block}
.sm2-th-date .d-num{font-size:16px;font-weight:700;color:#463C38;line-height:1;transition:color .15s,font-weight .15s,font-size .15s}
.sm2-th-date .d-pip{width:5px;height:5px;background:#2196F3;border-radius:50%;margin-top:3px;display:block}
.sm2-th-date.sun .d-num{color:#E53935}
.sm2-th-date.sat .d-num{color:#1E88E5}
.sm2-th-date.today{border-left:2px solid rgba(33,150,243,.4);border-right:2px solid rgba(33,150,243,.4)}
.sm2-th-date .d-dow{font-size:10px;color:#aaa;margin-top:2px;transition:color .12s,font-weight .12s}
.sm2-th-date.sel{background:#dbeafe!important;border-bottom:2px solid rgba(33,150,243,.5)}
.sm2-th-date.sel .d-num{color:#1565C0!important;font-weight:900!important;font-size:18px!important}
.sm2-th-date.sel .d-dow{color:#1565C0!important;font-weight:700!important}
/* ── タイムラインボディ ──────────────────────────── */
.sm2-body{position:relative;display:flex}
.sm2-grid-line{position:absolute;left:0;right:0;pointer-events:none;border-top:1px solid rgba(0,0,0,.08)}
.sm2-grid-line.half{border-top:1px dashed rgba(0,0,0,.04)}
.sm2-day-col{flex:1;min-width:72px;position:relative;border-left:1px solid rgba(0,0,0,.05)}
.sm2-day-col.today-col{border-left:2px solid rgba(33,150,243,.3);border-right:2px solid rgba(33,150,243,.3)}
/* ドラッグ中のカラムハイライト */
.sm2-drag-hl{position:absolute;left:0;right:0;background:rgba(33,150,243,.12);border-top:2px solid rgba(33,150,243,.5);border-bottom:2px solid rgba(33,150,243,.5);border-radius:2px;pointer-events:none;z-index:10;transition:top .04s ease-out,height .04s ease-out}
/* ── 凡例 ────────────────────────────────────────── */
.sm2-legend{display:flex;align-items:center;gap:10px;padding:5px 0 0;font-size:11px;color:#9E9490;flex-shrink:0;flex-wrap:wrap}
.sm2-legend-item{display:flex;align-items:center;gap:4px}
.sm2-legend-sw{width:12px;height:12px;border-radius:2px;display:inline-block}
/* ── モーダル ────────────────────────────────────── */
.sm2-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center}
.sm2-modal{background:#fff;border-radius:12px;width:460px;max-width:94vw;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.18)}
.sm2-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #eee}
.sm2-modal-head h2{font-size:15px;font-weight:700}
.sm2-modal-x{background:none;border:none;font-size:20px;cursor:pointer;color:#aaa}
.sm2-modal-body{padding:14px 18px 18px;display:flex;flex-direction:column;gap:10px}
.sm2-form-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sm2-form-lbl{font-size:12px;font-weight:600;color:#6B5F59;min-width:44px}
.sm2-finput{padding:4px 7px;border:1px solid #e0dbd5;border-radius:5px;font-size:12px}
.sm2-dow-chips{display:flex;gap:3px;flex-wrap:wrap}
.sm2-dow-chip{padding:3px 7px;border-radius:4px;font-size:12px;cursor:pointer;border:1px solid #e0dbd5;background:#f5f4ef;font-weight:500}
.sm2-dow-chip.on{background:#3A5F56;color:#fff;border-color:#3A5F56}
.sm2-dow-chip.sun.on{background:#E53935;border-color:#E53935}
.sm2-dow-chip.sat.on{background:#1E88E5;border-color:#1E88E5}
.sm2-st-opts{display:flex;gap:5px}
.sm2-st-opt{padding:4px 9px;border-radius:5px;font-size:12px;cursor:pointer;border:1px solid;font-weight:600}
.sm2-preview-bar{background:#f5f4ef;border-radius:6px;padding:7px 12px;font-size:12px;text-align:center;color:#6B5F59}
.sm2-preview-n{font-size:17px;font-weight:800;color:#3A5F56;margin-right:3px}
.sm2-modal-acts{display:flex;gap:7px;justify-content:flex-end}
`

// paintColor: 'open'（デフォルト）= 自動トグル、'request' = リクエスト塗り

export default function SlotManagement() {
    const now   = new Date()
    const today = fmtDate(now)

    // ── State ──
    const [weekStart,      setWeekStart]      = useState(today)
    const [slots,          setSlots]          = useState([])
    const [saving,         setSaving]         = useState(false)
    const [loading,        setLoading]        = useState(false)
    const [error,          setError]          = useState('')
    const [pendingUI,      setPendingUI]      = useState({})
    const [showBulk,       setShowBulk]       = useState(false)
    const [bizStart,       setBizStart]       = useState('09:00')
    const [bizEnd,         setBizEnd]         = useState('19:00')
    const [showBizPopover, setShowBizPopover] = useState(false)
    const [paintColor,     setPaintColor]     = useState('open')
    const [activeCol,      setActiveCol]      = useState(null)  // { date, startMin, endMin }

    const visibleDates = useMemo(() => genWeek(weekStart), [weekStart])

    const weekLabel = useMemo(() => {
        const s = new Date(weekStart + 'T00:00:00')
        const e = new Date(visibleDates[6] + 'T00:00:00')
        const sm = s.getMonth() + 1, em = e.getMonth() + 1
        if (sm === em) return `${s.getFullYear()}年 ${sm}月 ${s.getDate()}〜${e.getDate()}日`
        return `${sm}月${s.getDate()}日〜${em}月${e.getDate()}日`
    }, [weekStart, visibleDates])

    // ── タイムライン計算値 ──
    const bizStartMin    = useMemo(() => t2m(bizStart), [bizStart])
    const bizEndMin      = useMemo(() => t2m(bizEnd),   [bizEnd])
    const totalBizMins   = bizEndMin - bizStartMin
    const timelineHeight = totalBizMins * PX_PER_MIN
    const minToY         = min  => (min - bizStartMin) * PX_PER_MIN
    const timeToY        = time => minToY(t2m(time))
    const bizTimes       = useMemo(() => genTimes(bizStart, bizEnd), [bizStart, bizEnd])

    // 営業時間の長さに応じてラベル密度を最適化（10h以上→1時間, 未満→30分）
    const hourMarks = useMemo(() => {
        const spanH   = totalBizMins / 60
        const stepMin = spanH >= 10 ? 60 : 30
        const marks   = []
        const first   = Math.ceil(bizStartMin / stepMin) * stepMin
        for (let m = first; m <= bizEndMin; m += stepMin) marks.push(m)
        return marks
    }, [bizStartMin, bizEndMin, totalBizMins])

    // 30分ハーフラインは1時間ステップ時のみ表示（30分ステップなら本線で表示済み）
    const showHalfLines = useMemo(() => totalBizMins / 60 >= 10, [totalBizMins])

    // コーナーに表示する月（週が月を跨ぐ場合は「3-4月」）
    const cornerMonth = useMemo(() => {
        const s = new Date(weekStart + 'T00:00:00')
        const e = new Date(visibleDates[6] + 'T00:00:00')
        const sm = s.getMonth() + 1, em = e.getMonth() + 1
        return sm === em ? `${sm}月` : `${sm}-${em}月`
    }, [weekStart, visibleDates])

    // ── システム設定から営業時間取得 ──
    useEffect(() => {
        getSystemSettings().then(s => {
            if (s['営業開始']) setBizStart(s['営業開始'])
            if (s['営業終了']) setBizEnd(s['営業終了'])
        }).catch(() => {})
    }, [])

    // ── スロットデータ読み込み ──
    const loadedMonthsRef = useRef(new Set())
    const slotMapRef      = useRef({})

    async function loadMonths(months) {
        const newM = months.filter(m => !loadedMonthsRef.current.has(m))
        if (!newM.length) return
        setLoading(true)
        try {
            const newRanges = (await Promise.all(newM.map(m => getRanges(m)))).flat()
            setSlots(prev => {
                const filtered = prev.filter(s => !newM.some(m => s.date.startsWith(m)))
                return [...filtered, ...newRanges]
            })
            newM.forEach(m => loadedMonthsRef.current.add(m))
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        const months = [...new Set(visibleDates.map(d => d.substring(0, 7)))]
        loadMonths(months)
    }, [visibleDates]) // eslint-disable-line

    // 範囲ドキュメントを10分スロットマップに展開
    const slotMap = useMemo(() => {
        const m = {}
        slots.forEach(range => {
            let min = t2m(range.startTime), em = t2m(range.endTime)
            while (min < em) {
                const t = m2t(min)
                m[`${range.date}_${t}`] = { date: range.date, time: t, open: range.status }
                min += SNAP
            }
        })
        return m
    }, [slots])
    slotMapRef.current = slotMap

    const viewMap = useMemo(() => {
        const m = { ...slotMap }
        Object.entries(pendingUI).forEach(([k, st]) => {
            m[k] = m[k] ? { ...m[k], open: st }
                : (() => { const [d, t] = k.split('_'); return { date: d, time: t, open: st } })()
        })
        return m
    }, [slotMap, pendingUI])

    // 日付ごとの連続ブロック（viewMapが変わるたびに再計算）
    const mergedRuns = useMemo(() => {
        const result = {}
        visibleDates.forEach(date => { result[date] = computeRuns(date, bizTimes, viewMap) })
        return result
    }, [visibleDates, bizTimes, viewMap])

    const summary = useMemo(() => {
        let openMins = 0, reqMins = 0
        visibleDates.forEach(d => {
            bizTimes.forEach(t => {
                const s = viewMap[`${d}_${t}`]
                if (!s) return
                const st = norm(s.open)
                if (st === 'open')    openMins += SNAP
                if (st === 'request') reqMins  += SNAP
            })
        })
        const fmt = mins => { const h = Math.floor(mins/60), m = mins%60; return m ? `${h}h${m}m` : `${h}h` }
        return { open: fmt(openMins), request: fmt(reqMins) }
    }, [visibleDates, bizTimes, viewMap])

    // ── Firestore 保存（範囲方式、10分粒度） ──
    async function commitChanges(changes) {
        const entries = Object.entries(changes)
        if (!entries.length) return

        const affectedDates = [...new Set(entries.map(([k]) => k.split('_')[0]))]

        const newRanges = []
        affectedDates.forEach(date => {
            // 既存 + 変更を合成
            const merged = {}
            bizTimes.forEach(t => {
                const existing = slotMapRef.current[`${date}_${t}`]
                merged[t] = existing ? norm(existing.open) : 'closed'
            })
            entries.filter(([k]) => k.startsWith(date + '_')).forEach(([k, st]) => {
                const t = k.split('_')[1]
                if (merged[t] !== undefined) merged[t] = st
            })

            // ランレングス符号化 → 範囲に変換
            let i = 0
            while (i < bizTimes.length) {
                const status = merged[bizTimes[i]]
                let j = i + 1
                while (j < bizTimes.length && merged[bizTimes[j]] === status) j++
                if (status === 'open' || status === 'request') {
                    newRanges.push({
                        date,
                        startTime: bizTimes[i],
                        endTime: m2t(t2m(bizTimes[j - 1]) + SNAP),
                        status
                    })
                }
                i = j
            }
        })

        setSaving(true); setPendingUI({})
        try {
            await updateSlots({ dates: affectedDates, ranges: newRanges })
            const months = [...new Set(affectedDates.map(d => d.substring(0, 7)))]
            const refreshed = (await Promise.all(months.map(m => getRanges(m)))).flat()
            setSlots(prev => {
                const filtered = prev.filter(s => !months.some(m => s.date.startsWith(m)))
                return [...filtered, ...refreshed]
            })
        } catch (e) { setError(`保存失敗: ${e.message}`) }
        finally { setSaving(false) }
    }

    // ── 軸ハイライト（ドラッグ中にリアルタイム強調） ──
    const axisHlRef       = useRef({ dates: new Set() })
    const timeBarRef      = useRef(null)
    const timeBarStartRef = useRef(null)
    const timeBarEndRef   = useRef(null)

    function setAxisHighlight(dates, startMin, endMin) {
        // 日付ヘッダー強調
        const prev = axisHlRef.current
        prev.dates.forEach(d => document.querySelector(`[data-date="${d}"]`)?.classList.remove('sel'))
        dates.forEach(d => document.querySelector(`[data-date="${d}"]`)?.classList.add('sel'))
        axisHlRef.current = { dates }

        // 時間バー
        const bar = timeBarRef.current
        if (bar) {
            if (startMin !== null && endMin !== null && endMin > startMin) {
                const barTop = minToY(startMin)
                const barH   = Math.max(SNAP * PX_PER_MIN, (endMin - startMin) * PX_PER_MIN)
                bar.style.cssText = `display:block;top:${barTop}px;height:${barH}px`
                if (timeBarStartRef.current) timeBarStartRef.current.textContent = m2t(startMin)
                if (timeBarEndRef.current)   timeBarEndRef.current.textContent   = m2t(endMin)
            } else {
                bar.style.display = 'none'
            }
        }

        // 時間ラベルのポップアウト強調
        document.querySelectorAll('[data-time-th]').forEach(el => {
            if (startMin === null) { el.classList.remove('sel'); return }
            const labelMin = t2m(el.dataset.timeTh)
            el.classList.toggle('sel', labelMin >= startMin && labelMin <= endMin)
        })
    }

    // ── インタラクション（連続ペイント + エッジドラッグ） ──
    const wrapRef            = useRef(null)
    const interactionRef     = useRef(null)
    const pendingChangesRef  = useRef({})

    // 日付列とY座標から操作モード（paint / resize）を判定
    // 列の右半分: エッジ近接でリサイズ（上下とも）
    // 列の左半分: 常にペイントモード（自動トグル → 既存ブロック上なら削除）
    const detectInteraction = useCallback((clientX, clientY) => {
        const wrap = wrapRef.current
        if (!wrap) return null
        const bodyEl = wrap.querySelector('.sm2-body')
        if (!bodyEl) return null

        // どの日付列か判定
        const cols = wrap.querySelectorAll('.sm2-day-col')
        let date = null, colRect = null
        for (const col of cols) {
            const r = col.getBoundingClientRect()
            if (clientX >= r.left && clientX < r.right) {
                date = col.dataset.date
                colRect = r
                break
            }
        }
        if (!date || date < today) return null

        // Y → 時刻
        const bodyRect = bodyEl.getBoundingClientRect()
        const relY = clientY - bodyRect.top
        const min  = clamp(snap10(bizStartMin + relY / PX_PER_MIN), bizStartMin, bizEndMin - SNAP)

        // 列内のX位置: 右半分でのみエッジ検出（リサイズ）
        const colRelX = clientX - colRect.left
        const isRightHalf = colRelX >= colRect.width / 2

        if (isRightHalf) {
            // エッジ近接チェック（上下とも）
            const blocks = extractBlocks(date, mergedRuns, bizStartMin)
            for (const block of blocks) {
                if (Math.abs(relY - block.topPx) < EDGE_THRESH) {
                    const prevBlock = blocks.filter(b => b.endMin <= block.startMin).pop()
                    const minBound  = prevBlock ? prevBlock.endMin : bizStartMin
                    return { mode: 'resize', date, edge: 'top', block, minBound, maxBound: block.endMin - SNAP }
                }
                if (Math.abs(relY - block.bottomPx) < EDGE_THRESH) {
                    const nextBlock = blocks.find(b => b.startMin >= block.endMin)
                    const maxBound  = nextBlock ? nextBlock.startMin : bizEndMin
                    return { mode: 'resize', date, edge: 'bottom', block, minBound: block.startMin + SNAP, maxBound }
                }
            }
        }

        // 左半分 or エッジ外 → ペイントモード（自動トグル）
        return { mode: 'paint', date, startMin: min }
    }, [today, bizStartMin, bizEndMin, mergedRuns]) // eslint-disable-line

    // ── マウスハンドラ ──
    function onWrapMouseDown(e) {
        if (e.button !== 0) return
        e.preventDefault()
        const inter = detectInteraction(e.clientX, e.clientY)
        if (!inter) return

        inter.startClientX = e.clientX
        inter.startClientY = e.clientY
        interactionRef.current = inter
        pendingChangesRef.current = {}

        if (inter.mode === 'paint') {
            // 自動トグル: 開始地点のステータスを見て target を決定
            if (paintColor === 'open') {
                const existingSlot = slotMapRef.current[`${inter.date}_${m2t(inter.startMin)}`]
                const cur = existingSlot ? norm(existingSlot.open) : 'closed'
                inter.targetStatus = cur === 'open' ? 'closed' : 'open'
            } else {
                // リクエストモード: 開始地点に応じてトグル
                const existingSlot = slotMapRef.current[`${inter.date}_${m2t(inter.startMin)}`]
                const cur = existingSlot ? norm(existingSlot.open) : 'closed'
                inter.targetStatus = cur === 'request' ? 'open' : 'request'
            }
            const changes = { [`${inter.date}_${m2t(inter.startMin)}`]: inter.targetStatus }
            pendingChangesRef.current = changes
            setPendingUI(changes)
            setActiveCol({ date: inter.date, startMin: inter.startMin, endMin: inter.startMin + SNAP })
            setAxisHighlight(new Set([inter.date]), inter.startMin, inter.startMin + SNAP)
        } else {
            // リサイズ開始（プレビューなし、カーソル変更のみ）
            wrap.current?.style && (wrapRef.current.style.cursor = 'ns-resize')
        }
    }

    function onWrapMouseMove(e) {
        const inter = interactionRef.current
        if (!inter) {
            // アイドル時：エッジ近接でカーソル変更
            const probe = detectInteraction(e.clientX, e.clientY)
            if (wrapRef.current) {
                wrapRef.current.style.cursor = (probe && probe.mode === 'resize') ? 'ns-resize' : 'crosshair'
            }
            return
        }

        const bodyEl = wrapRef.current?.querySelector('.sm2-body')
        if (!bodyEl) return
        const bodyRect = bodyEl.getBoundingClientRect()
        const relY = e.clientY - bodyRect.top
        const rawMin = snap10(bizStartMin + relY / PX_PER_MIN)

        if (inter.mode === 'paint') {
            const curMin = clamp(rawMin, bizStartMin, bizEndMin - SNAP)
            const lo = Math.min(inter.startMin, curMin)
            const hi = Math.max(inter.startMin, curMin) + SNAP
            const changes = {}
            for (let m = lo; m < hi; m += SNAP) {
                changes[`${inter.date}_${m2t(m)}`] = inter.targetStatus
            }
            pendingChangesRef.current = changes
            setPendingUI(changes)
            setActiveCol({ date: inter.date, startMin: lo, endMin: hi })
            setAxisHighlight(new Set([inter.date]), lo, hi)
        } else if (inter.mode === 'resize') {
            const newEdgeMin = clamp(rawMin, inter.minBound, inter.maxBound)
            const block = inter.block
            const changes = {}

            if (inter.edge === 'top') {
                const oldStart = block.startMin, newStart = newEdgeMin
                if (newStart < oldStart) {
                    for (let m = newStart; m < oldStart; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = block.status
                } else {
                    for (let m = oldStart; m < newStart; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = 'closed'
                }
                setActiveCol({ date: inter.date, startMin: newStart, endMin: block.endMin })
                setAxisHighlight(new Set([inter.date]), newStart, block.endMin)
            } else {
                const oldEnd = block.endMin, newEnd = newEdgeMin
                if (newEnd > oldEnd) {
                    for (let m = oldEnd; m < newEnd; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = block.status
                } else {
                    for (let m = newEnd; m < oldEnd; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = 'closed'
                }
                setActiveCol({ date: inter.date, startMin: block.startMin, endMin: newEnd })
                setAxisHighlight(new Set([inter.date]), block.startMin, newEnd)
            }

            pendingChangesRef.current = changes
            setPendingUI(changes)
            if (wrapRef.current) wrapRef.current.style.cursor = 'ns-resize'
        }
    }

    function onWrapMouseUp(e) {
        const inter = interactionRef.current
        interactionRef.current = null
        setActiveCol(null)
        setAxisHighlight(new Set(), null, null)
        if (wrapRef.current) wrapRef.current.style.cursor = 'crosshair'
        if (!inter) return

        const dx = Math.abs(e.clientX - inter.startClientX)
        const dy = Math.abs(e.clientY - inter.startClientY)

        if (dx < 5 && dy < 5) {
            // タップ操作（ドラッグなし）
            setPendingUI({})
            pendingChangesRef.current = {}
            handleTap(inter.date, e.clientX, e.clientY)
        } else {
            // ドラッグ完了 → 確定
            const changes = { ...pendingChangesRef.current }
            setPendingUI({})
            pendingChangesRef.current = {}
            if (Object.keys(changes).length) commitChanges(changes)
        }
    }

    // タップ: 空きモードは無効（誤タップ防止）、リクエストモードのみ既存ブロックの open↔request 切替
    function handleTap(date, clientX, clientY) {
        if (paintColor === 'open') return  // 空きモードはタップ無効

        const bodyEl = wrapRef.current?.querySelector('.sm2-body')
        if (!bodyEl) return
        const bodyRect = bodyEl.getBoundingClientRect()
        const relY = clientY - bodyRect.top
        const min  = clamp(snap10(bizStartMin + relY / PX_PER_MIN), bizStartMin, bizEndMin - SNAP)

        const blocks = extractBlocks(date, mergedRuns, bizStartMin)
        const tapped = blocks.find(b => min >= b.startMin && min < b.endMin)

        if (!tapped) return  // 空白タップは無視（新規作成防止）

        // 既存ブロックの open↔request 切替のみ
        const next = tapped.status === 'open' ? 'request'
                   : tapped.status === 'request' ? 'open'
                   : null
        if (!next) return  // closed ブロックは無視

        const changes = {}
        for (let m = tapped.startMin; m < tapped.endMin; m += SNAP) {
            changes[`${date}_${m2t(m)}`] = next
        }
        if (Object.keys(changes).length) commitChanges(changes)
    }

    // ── タッチハンドラ ──
    function onScrollTouchStart(e) {
        const t = e.touches[0]
        const inter = detectInteraction(t.clientX, t.clientY)
        if (!inter) return  // タッチが日付列外 → スクロール許可

        e.preventDefault()  // ペイント/リサイズ開始 → スクロール抑制
        inter.startClientX = t.clientX
        inter.startClientY = t.clientY
        interactionRef.current = inter
        pendingChangesRef.current = {}

        if (inter.mode === 'paint') {
            // 自動トグル: 開始地点のステータスを見て target を決定
            if (paintColor === 'open') {
                const existingSlot = slotMapRef.current[`${inter.date}_${m2t(inter.startMin)}`]
                const cur = existingSlot ? norm(existingSlot.open) : 'closed'
                inter.targetStatus = cur === 'open' ? 'closed' : 'open'
            } else {
                const existingSlot = slotMapRef.current[`${inter.date}_${m2t(inter.startMin)}`]
                const cur = existingSlot ? norm(existingSlot.open) : 'closed'
                inter.targetStatus = cur === 'request' ? 'open' : 'request'
            }
            const changes = { [`${inter.date}_${m2t(inter.startMin)}`]: inter.targetStatus }
            pendingChangesRef.current = changes
            setPendingUI(changes)
            setActiveCol({ date: inter.date, startMin: inter.startMin, endMin: inter.startMin + SNAP })
            setAxisHighlight(new Set([inter.date]), inter.startMin, inter.startMin + SNAP)
        }
    }

    function onScrollTouchMove(e) {
        const inter = interactionRef.current
        if (!inter) return
        e.preventDefault()

        const t = e.touches[0]
        const bodyEl = wrapRef.current?.querySelector('.sm2-body')
        if (!bodyEl) return
        const bodyRect = bodyEl.getBoundingClientRect()
        const relY = t.clientY - bodyRect.top
        const rawMin = snap10(bizStartMin + relY / PX_PER_MIN)

        if (inter.mode === 'paint') {
            const curMin = clamp(rawMin, bizStartMin, bizEndMin - SNAP)
            const lo = Math.min(inter.startMin, curMin)
            const hi = Math.max(inter.startMin, curMin) + SNAP
            const changes = {}
            for (let m = lo; m < hi; m += SNAP) {
                changes[`${inter.date}_${m2t(m)}`] = inter.targetStatus
            }
            pendingChangesRef.current = changes
            setPendingUI(changes)
            setActiveCol({ date: inter.date, startMin: lo, endMin: hi })
            setAxisHighlight(new Set([inter.date]), lo, hi)
        } else if (inter.mode === 'resize') {
            const newEdgeMin = clamp(rawMin, inter.minBound, inter.maxBound)
            const block = inter.block
            const changes = {}

            if (inter.edge === 'top') {
                const oldStart = block.startMin, newStart = newEdgeMin
                if (newStart < oldStart) {
                    for (let m = newStart; m < oldStart; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = block.status
                } else {
                    for (let m = oldStart; m < newStart; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = 'closed'
                }
                setActiveCol({ date: inter.date, startMin: newStart, endMin: block.endMin })
                setAxisHighlight(new Set([inter.date]), newStart, block.endMin)
            } else {
                const oldEnd = block.endMin, newEnd = newEdgeMin
                if (newEnd > oldEnd) {
                    for (let m = oldEnd; m < newEnd; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = block.status
                } else {
                    for (let m = newEnd; m < oldEnd; m += SNAP) changes[`${inter.date}_${m2t(m)}`] = 'closed'
                }
                setActiveCol({ date: inter.date, startMin: block.startMin, endMin: newEnd })
                setAxisHighlight(new Set([inter.date]), block.startMin, newEnd)
            }

            pendingChangesRef.current = changes
            setPendingUI(changes)
        }
    }

    function onScrollTouchEnd(e) {
        const inter = interactionRef.current
        interactionRef.current = null
        setActiveCol(null)
        setAxisHighlight(new Set(), null, null)
        if (!inter) return

        const changes = { ...pendingChangesRef.current }
        setPendingUI({})
        pendingChangesRef.current = {}

        // タップ判定（移動量が小さい → タップ）
        if (Object.keys(changes).length <= 1 && inter.mode === 'paint') {
            handleTap(inter.date, inter.startClientX, inter.startClientY)
        } else {
            // ドラッグ完了 → 確定
            if (Object.keys(changes).length) commitChanges(changes)
        }
    }

    // ── 一括時間帯設定モーダル ──
    function BulkModal({ onClose }) {
        const [f, setF] = useState({
            startDate: today,
            endDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })(),
            startTime: bizStart,
            endTime:   bizEnd,
            days: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
            status: 'open',
        })
        const [sub, setSub] = useState(false)
        const preview = useMemo(() => {
            let c = 0
            const s = new Date(f.startDate + 'T00:00:00'), e = new Date(f.endDate + 'T00:00:00')
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                if (f.days[d.getDay()]) c++
            }
            return c
        }, [f])
        async function go(ev) {
            ev.preventDefault(); setSub(true)
            const dates = [], ranges = []
            const s = new Date(f.startDate + 'T00:00:00'), e = new Date(f.endDate + 'T00:00:00')
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                if (!f.days[d.getDay()]) continue
                const ds = fmtDate(d)
                dates.push(ds)
                if (f.status !== 'closed') {
                    ranges.push({ date: ds, startTime: f.startTime, endTime: f.endTime, status: f.status })
                }
            }
            if (!dates.length) { alert('対象0件'); setSub(false); return }
            try {
                await updateSlots({ dates, ranges })
                const months = [...new Set(dates.map(d => d.substring(0, 7)))]
                const refreshed = (await Promise.all(months.map(m => getRanges(m)))).flat()
                setSlots(prev => {
                    const filtered = prev.filter(s => !months.some(m => s.date.startsWith(m)))
                    return [...filtered, ...refreshed]
                })
                onClose()
                alert(`${dates.length}日分を設定しました`)
            } catch (err) { alert(`失敗: ${err.message}`) }
            finally { setSub(false) }
        }
        const ST = [
            { k: 'open',    label: '空き',       bg: '#66BB6A', bc: '#4CAF50', tc: '#fff' },
            { k: 'request', label: 'リクエスト', bg: '#FFA726', bc: '#FB8C00', tc: '#fff' },
            { k: 'closed',  label: '休業（クリア）', bg: '#E8E5DF', bc: '#bbb', tc: '#555' },
        ]
        return (
            <div className="sm2-overlay" onClick={onClose}>
                <div className="sm2-modal" onClick={e => e.stopPropagation()}>
                    <div className="sm2-modal-head">
                        <h2>一括時間帯設定</h2>
                        <button className="sm2-modal-x" onClick={onClose}>×</button>
                    </div>
                    <form onSubmit={go} className="sm2-modal-body">
                        <div className="sm2-form-row">
                            <label className="sm2-form-lbl">期間</label>
                            <input type="date" className="sm2-finput" required value={f.startDate} onChange={e => setF(p => ({ ...p, startDate: e.target.value }))} />
                            <span style={{ color: '#aaa' }}>→</span>
                            <input type="date" className="sm2-finput" required value={f.endDate}   onChange={e => setF(p => ({ ...p, endDate: e.target.value }))} />
                        </div>
                        <div className="sm2-form-row">
                            <label className="sm2-form-lbl">曜日</label>
                            <div className="sm2-dow-chips">
                                {DAY_LABELS.map((n, i) => (
                                    <button key={i} type="button"
                                        className={`sm2-dow-chip${f.days[i] ? ' on' : ''} ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}
                                        onClick={() => setF(p => ({ ...p, days: { ...p.days, [i]: !p.days[i] } }))}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sm2-form-row">
                            <label className="sm2-form-lbl">時間帯</label>
                            <input type="time" className="sm2-finput" required value={f.startTime} onChange={e => setF(p => ({ ...p, startTime: e.target.value }))} />
                            <span style={{ color: '#aaa' }}>→</span>
                            <input type="time" className="sm2-finput" required value={f.endTime}   onChange={e => setF(p => ({ ...p, endTime: e.target.value }))} />
                        </div>
                        <div className="sm2-form-row">
                            <label className="sm2-form-lbl">状態</label>
                            <div className="sm2-st-opts">
                                {ST.map(({ k, label, bg, bc, tc }) => (
                                    <button key={k} type="button" className="sm2-st-opt"
                                        style={{
                                            color:       f.status === k ? tc    : '#463C38',
                                            background:  f.status === k ? bg    : '#f5f4ef',
                                            borderColor: f.status === k ? bc    : '#e0dbd5',
                                        }}
                                        onClick={() => setF(p => ({ ...p, status: k }))}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sm2-preview-bar">
                            <span className="sm2-preview-n">{preview.toLocaleString()}</span>日分を設定
                        </div>
                        <div className="sm2-modal-acts">
                            <button type="button" className="sm2-btn sm2-btn-ghost"    onClick={onClose}>キャンセル</button>
                            <button type="submit"  className="sm2-btn sm2-btn-primary" disabled={sub || !preview}>
                                {sub ? '設定中...' : '設定する'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    // ── レンダリング ──
    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content" style={{ maxWidth: 'none', padding: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <style>{CSS}</style>
                <div className="sm2-page">

                    {/* トップバー */}
                    <div className="sm2-topbar">
                        <h1 className="sm2-title">空き枠管理</h1>
                        <span className="sm2-week-lbl">{weekLabel}</span>
                        <div className="sm2-controls">
                            {/* 営業時間ポップオーバー */}
                            <button className="sm2-biz-trigger" onClick={() => setShowBizPopover(p => !p)}>
                                🕐 営業時間 {bizStart}〜{bizEnd}
                            </button>
                            {showBizPopover && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => setShowBizPopover(false)} />
                                    <div className="sm2-biz-popover">
                                        <div style={{ marginBottom: 12 }}>
                                            <label>開始時刻</label>
                                            <input type="time" value={bizStart} onChange={e => setBizStart(e.target.value)} />
                                        </div>
                                        <div style={{ marginBottom: 16 }}>
                                            <label>終了時刻</label>
                                            <input type="time" value={bizEnd} onChange={e => setBizEnd(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="sm2-btn sm2-btn-ghost" onClick={() => setShowBizPopover(false)}>
                                                キャンセル
                                            </button>
                                            <button className="sm2-btn sm2-btn-primary" onClick={() => {
                                                updateSystemSettings({ '営業開始': bizStart, '営業終了': bizEnd })
                                                    .catch(e => setError(e.message))
                                                setShowBizPopover(false)
                                            }}>
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                            <button className="sm2-btn sm2-btn-ghost"   onClick={() => setWeekStart(today)}>今日</button>
                            <button className="sm2-btn sm2-btn-primary" onClick={() => setShowBulk(true)}>＋ 一括作成</button>
                        </div>
                    </div>

                    {/* ステータスバー + ペイントカラー */}
                    <div className="sm2-statusbar">
                        <div className="sm2-stat">
                            <span className="sm2-dot" style={{ background: '#66BB6A' }} />
                            <span>空き: {summary.open}</span>
                        </div>
                        <div className="sm2-stat">
                            <span className="sm2-dot" style={{ background: '#FFA726' }} />
                            <span>リクエスト: {summary.request}</span>
                        </div>
                        {saving  && <span className="sm2-saving">保存中...</span>}
                        {loading && <span style={{ color: '#bbb', fontSize: 12 }}>読み込み中...</span>}

                        {/* リクエストモード切替 */}
                        <button
                            className={`sm2-paint-btn${paintColor === 'request' ? ' active' : ''}`}
                            style={paintColor === 'request'
                                ? { borderColor: '#FB8C00', marginLeft: 'auto' }
                                : { marginLeft: 'auto' }}
                            onClick={() => setPaintColor(p => p === 'request' ? 'open' : 'request')}>
                            <span className="sm2-paint-swatch" style={{ background: '#FFA726' }} />
                            リクエストモード
                        </button>
                    </div>

                    {error && (
                        <div className="sm2-err">
                            {error}
                            <button className="sm2-err-x" onClick={() => setError('')}>×</button>
                        </div>
                    )}

                    {/* ── タイムライングリッド ── */}
                    <div
                        className="sm2-scroll"
                        ref={wrapRef}
                        onMouseDown={onWrapMouseDown}
                        onMouseMove={onWrapMouseMove}
                        onMouseUp={onWrapMouseUp}
                        onMouseLeave={e => { if (interactionRef.current) onWrapMouseUp(e) }}
                        onTouchStart={onScrollTouchStart}
                        onTouchMove={onScrollTouchMove}
                        onTouchEnd={onScrollTouchEnd}
                    >
                        <div className="sm2-inner">
                            {/* ── 左カラム：時間軸（sticky left, z-index:300） ── */}
                            <div className="sm2-time-col">
                                <div className="sm2-corner">
                                    <span className="corner-month">{cornerMonth}</span>
                                </div>
                                <div className="sm2-time-marks" style={{ height: timelineHeight }}>
                                    <div ref={timeBarRef} className="sm2-time-bar">
                                        <span ref={timeBarStartRef} className="sm2-time-tip sm2-time-tip-start" />
                                        <span ref={timeBarEndRef}   className="sm2-time-tip sm2-time-tip-end" />
                                    </div>
                                    {hourMarks.map(m => {
                                        if (minToY(m) < 10) return null  // corner に隠れる位置はスキップ
                                        return (
                                            <div
                                                key={m}
                                                data-time-th={m2t(m)}
                                                className="sm2-hour-label"
                                                style={{ top: minToY(m) }}
                                            >
                                                {m2t(m)}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* ── 右カラム：日付ヘッダー（週ナビ付き）+ タイムライン ── */}
                            <div className="sm2-main-col">
                                <div className="sm2-date-row">
                                    {/* 週戻る矢印 */}
                                    <button className="sm2-date-arrow" onClick={() => setWeekStart(d => addDays(d, -7))}>‹</button>

                                    {visibleDates.map((date, idx) => {
                                        const d       = new Date(date + 'T00:00:00')
                                        const dow     = d.getDay()
                                        const isToday = date === today
                                        const newM    = idx === 0 || date.substring(0, 7) !== visibleDates[idx - 1].substring(0, 7)
                                        return (
                                            <div key={date} data-date={date}
                                                className={['sm2-th-date', dow === 0 ? 'sun' : dow === 6 ? 'sat' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}>
                                                <span className="d-mth">{newM ? `${d.getMonth() + 1}月` : ''}</span>
                                                <span className="d-num">{d.getDate()}</span>
                                                <span className="d-dow">{DAY_LABELS[dow]}</span>
                                                {isToday && <span className="d-pip" />}
                                            </div>
                                        )
                                    })}

                                    {/* 週進む矢印 */}
                                    <button className="sm2-date-arrow" onClick={() => setWeekStart(d => addDays(d, 7))}>›</button>
                                </div>

                                {/* タイムラインボディ */}
                                <div className="sm2-body" style={{ height: timelineHeight }}>
                                    {/* グリッドライン（hourMarks に基づく） */}
                                    {hourMarks.map(m => (
                                        <div key={m} className="sm2-grid-line" style={{ top: minToY(m) }} />
                                    ))}
                                    {showHalfLines && hourMarks.map(m => {
                                        const halfM = m + 30
                                        if (halfM > bizEndMin) return null
                                        return <div key={`${m}-h`} className="sm2-grid-line half" style={{ top: minToY(halfM) }} />
                                    })}

                                    {/* 左スペーサー（矢印幅と合わせる） */}
                                    <div style={{ width: 36, flexShrink: 0 }} />

                                    {/* 日付カラム */}
                                    {visibleDates.map(date => {
                                        const isPast = date < today
                                        const hl = activeCol?.date === date
                                        return (
                                            <div key={date} data-date={date}
                                                className={`sm2-day-col${date === today ? ' today-col' : ''}`}
                                                style={{ height: timelineHeight }}>
                                                {/* ドラッグ中のカラムハイライト */}
                                                {hl && (
                                                    <div className="sm2-drag-hl" style={{
                                                        top:    minToY(activeCol.startMin),
                                                        height: Math.max(SNAP * PX_PER_MIN, (activeCol.endMin - activeCol.startMin) * PX_PER_MIN),
                                                    }} />
                                                )}
                                                {/* 連続ビジュアルブロック */}
                                                {(mergedRuns[date] || []).map(run => (
                                                    <div key={run.startTime}
                                                        className={`sm2-vblock ${isPast ? 'past' : run.status}`}
                                                        style={{
                                                            top:    timeToY(run.startTime),
                                                            height: run.count * SNAP * PX_PER_MIN,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )
                                    })}

                                    {/* 右スペーサー（矢印幅と合わせる） */}
                                    <div style={{ width: 36, flexShrink: 0 }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 凡例 */}
                    <div className="sm2-legend">
                        {[
                            { label: '空き',         bg: '#66BB6A' },
                            { label: 'リクエスト',   bg: '#FFA726' },
                            { label: '未設定・休業', bg: '#E8E5DF' },
                        ].map(({ label, bg }) => (
                            <div key={label} className="sm2-legend-item">
                                <span className="sm2-legend-sw" style={{ background: bg }} />
                                <span>{label}</span>
                            </div>
                        ))}
                        <span style={{ color: '#ccc', fontSize: 10, marginLeft: 'auto' }}>
                            {paintColor === 'open'
                                ? '左側ドラッグで空き↔未設定を切替 / 右側エッジで幅調整'
                                : 'ドラッグで範囲作成 / タップで空き↔リクエスト切替'}
                        </span>
                    </div>

                </div>
                {showBulk && <BulkModal onClose={() => setShowBulk(false)} />}
            </main>
        </div>
    )
}
