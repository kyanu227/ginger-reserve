/**
 * カレンダー管理帳（管理画面）
 * 自作月間カレンダー + 日別詳細パネル + 予約確認メール送信機能
 * 関連: api/reservations.js, api/menus.js, api/gas.js
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getReservations, getMenus, getOptions, updateReservation, cancelReservation, createReservation, formatPrice, formatDate, getStatusLabel, getStatusColor, getMenuName, searchCustomers } from '../lib/api'
import { DAY_LABELS, timeToMin, minToTime } from '../lib/constants'

// メニューID→色マップ（カレンダーセル内の予約行に使用）
const COLOR_MAP = {
    'enzyme-first': '#8B6914',
    'enzyme-regular': '#a0522d',
    'enzyme-bring': '#6a9f5b',
    'yomogi': '#4a7c59',
}
const DEFAULT_COLOR = '#3A5F56'

// 表示設定フィールド定義
const ALL_FIELDS = [
    { key: 'timeRange', label: '時間', defaultOn: true },
    { key: 'customerName', label: 'お客様名', defaultOn: true },
    { key: 'course', label: 'コース', defaultOn: true },
    { key: 'price', label: '金額', defaultOn: true },
    { key: 'guests', label: '人数', defaultOn: true },
    { key: 'phone', label: '電話番号', defaultOn: false },
    { key: 'email', label: 'メール', defaultOn: false },
    { key: 'options', label: 'オプション', defaultOn: false },
    { key: 'notes', label: '備考', defaultOn: true },
    { key: 'status', label: 'ステータス', defaultOn: true },
    { key: 'emailStatus', label: 'メール', defaultOn: true },
]

// マッサージチェア含む全体の終了時刻を計算
function calcFullEndTime(r, menu) {
    let curMin = timeToMin(r.time)
    // マッサージチェア（メインコースの前に直列）
    const hasMassage = (r.options || []).includes('massage-chair')
    if (hasMassage) {
        curMin += (r.massageDuration1 || 20) + (r.guests >= 2 ? (r.massageDuration2 || 20) : 0)
    }
    // メインコース
    curMin += menu?.duration || (menu?.durations ? menu.durations[0] : 20) || 20
    return minToTime(curMin)
}
const DEFAULT_FIELDS = ALL_FIELDS.filter(f => f.defaultOn).map(f => f.key)

function loadVisibleFields() {
    try {
        const saved = localStorage.getItem('gingerDayViewColumns')
        return saved ? JSON.parse(saved) : DEFAULT_FIELDS
    } catch { return DEFAULT_FIELDS }
}

// ── フィールドラベル ──────────────────────────────────────────
function FieldLabel({ children }) {
    return (
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            {children}
        </label>
    )
}

// ── 月間カレンダーグリッド ──────────────────────────────────────
function MonthlyCalendar({ reservations, menus, currentMonth, onMonthChange, onDayClick, selectedDate }) {
    const today = new Date().toISOString().split('T')[0]

    // 6週分（42セル）の日付配列を生成
    const cells = useMemo(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDay = new Date(year, month, 1).getDay() // 0=日
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const result = []

        // 前月の穴埋め
        const prevMonthDays = new Date(year, month, 0).getDate()
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = prevMonthDays - i
            const m = month === 0 ? 12 : month
            const y = month === 0 ? year - 1 : year
            result.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, otherMonth: true })
        }
        // 当月
        for (let d = 1; d <= daysInMonth; d++) {
            result.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, otherMonth: false })
        }
        // 次月の穴埋め（6週 = 42セルに満たす）
        const remaining = 42 - result.length
        for (let d = 1; d <= remaining; d++) {
            const m = month + 2 > 12 ? 1 : month + 2
            const y = month + 2 > 12 ? year + 1 : year
            result.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, otherMonth: true })
        }
        return result
    }, [currentMonth])

    // 日付 → 予約リスト（キャンセル除外、時刻順）
    const resByDate = useMemo(() => {
        const map = {}
        reservations
            .filter(r => r.status !== 'cancelled')
            .forEach(r => {
                if (!map[r.date]) map[r.date] = []
                map[r.date].push(r)
            })
        // 時刻順にソート
        Object.values(map).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)))
        return map
    }, [reservations])

    const prevMonth = () => {
        const d = new Date(currentMonth)
        d.setMonth(d.getMonth() - 1)
        onMonthChange(d)
    }
    const nextMonth = () => {
        const d = new Date(currentMonth)
        d.setMonth(d.getMonth() + 1)
        onMonthChange(d)
    }
    const goToday = () => {
        const d = new Date()
        onMonthChange(new Date(d.getFullYear(), d.getMonth(), 1))
    }

    const MAX_ENTRIES = 4

    return (
        <div>
            {/* ナビゲーション */}
            <div className="cal-nav">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
                    <span className="cal-nav-title">
                        {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                    </span>
                    <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
                </div>
                <button className="cal-nav-btn cal-nav-btn--today" onClick={goToday}>今月</button>
            </div>

            {/* グリッド */}
            <div className="cal-grid">
                {/* 曜日ヘッダー */}
                {DAY_LABELS.map((label, i) => (
                    <div key={i} className="cal-header-cell">{label}</div>
                ))}

                {/* 日セル */}
                {cells.map(cell => {
                    const dayRes = resByDate[cell.date] || []
                    const hasRes = dayRes.length > 0
                    const isToday = cell.date === today
                    const isSelected = cell.date === selectedDate
                    const classes = [
                        'cal-cell',
                        hasRes && 'cal-cell--has-reservations',
                        isToday && 'cal-cell--today',
                        isSelected && 'cal-cell--selected',
                        cell.otherMonth && 'cal-cell--other-month',
                    ].filter(Boolean).join(' ')

                    return (
                        <div key={cell.date} className={classes}
                            onClick={() => !cell.otherMonth && onDayClick(cell.date)}>
                            <div className="cal-cell-date">
                                <span className={isToday ? 'cal-cell-date-num--today' : undefined}>{cell.day}</span>
                                {hasRes && <span className="cal-cell-count">{dayRes.length}</span>}
                            </div>
                            {dayRes.slice(0, MAX_ENTRIES).map(r => {
                                const menu = menus.find(m => m.id === r.menuId)
                                return (
                                    <div key={r.id} className="cal-cell-entry"
                                        style={{ background: COLOR_MAP[r.menuId] || DEFAULT_COLOR }}>
                                        {r.time} {r.lastName} {menu?.name || ''}
                                    </div>
                                )
                            })}
                            {dayRes.length > MAX_ENTRIES && (
                                <div className="cal-cell-more">他 {dayRes.length - MAX_ENTRIES}件</div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── 表示設定ポップオーバー ──────────────────────────────────────
function DisplaySettings({ visibleFields, onChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    // 外側クリックで閉じる
    useEffect(() => {
        if (!open) return
        function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    function toggle(key) {
        const next = visibleFields.includes(key)
            ? visibleFields.filter(k => k !== key)
            : [...visibleFields, key]
        onChange(next)
        localStorage.setItem('gingerDayViewColumns', JSON.stringify(next))
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button className="cal-settings-btn" onClick={() => setOpen(!open)}>
                ⚙ 表示設定
            </button>
            {open && (
                <div className="cal-settings-popover">
                    {ALL_FIELDS.map(f => (
                        <label key={f.key}>
                            <input type="checkbox" checked={visibleFields.includes(f.key)} onChange={() => toggle(f.key)} />
                            {f.label}
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── 日別詳細パネル ──────────────────────────────────────────────
function DayDetailPanel({ date, reservations, menus, allOptions, visibleFields, onResClick, onBulkStatusChange, onNewReservation, panelRef }) {
    const [bulkBusy, setBulkBusy] = useState(false)

    const dayRes = useMemo(() =>
        reservations
            .filter(r => r.date === date && r.status !== 'cancelled')
            .sort((a, b) => a.time.localeCompare(b.time)),
        [reservations, date]
    )

    const d = new Date(date + 'T00:00:00')
    const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`

    const confirmedIds = dayRes.filter(r => r.status === 'confirmed').map(r => r.id)
    const pendingIds = dayRes.filter(r => r.status === 'pending').map(r => r.id)

    async function handleBulk(ids, newStatus) {
        const labels = { completed: '来店済み', confirmed: '確定' }
        if (!confirm(`${ids.length}件の予約を「${labels[newStatus]}」に変更しますか？`)) return
        setBulkBusy(true)
        await onBulkStatusChange(ids, newStatus)
        setBulkBusy(false)
    }

    function renderCell(r, key) {
        const menu = menus.find(m => m.id === r.menuId)
        switch (key) {
            case 'timeRange': {
                const endTime = calcFullEndTime(r, menu)
                return <>{r.time}〜{endTime}</>
            }
            case 'customerName': return <strong>{r.lastName} {r.firstName}</strong>
            case 'course': return <>{menu?.icon || ''} {menu?.name || r.menuId}</>
            case 'price': return <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatPrice(r.totalPrice)}</span>
            case 'guests': return <>{r.guests}名</>
            case 'phone': return <>{r.phone || '—'}</>
            case 'email': return <>{r.email || '—'}</>
            case 'options': {
                const opts = (r.options || []).map(id => allOptions.find(o => o.id === id)).filter(Boolean)
                return opts.length ? opts.map(o => o.name).join(', ') : '—'
            }
            case 'notes': return <>{r.notes || '—'}</>
            case 'status': return (
                <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: getStatusColor(r.status) + '18', color: getStatusColor(r.status),
                }}>
                    {getStatusLabel(r.status)}
                </span>
            )
            case 'emailStatus': {
                if (!r.email) return <span className="cal-email-badge cal-email-badge--no-email">—</span>
                if (r.emailSentAt) return <span className="cal-email-badge cal-email-badge--sent">✓</span>
                return <span className="cal-email-badge cal-email-badge--unsent">未</span>
            }
            default: return null
        }
    }

    const visibleCols = ALL_FIELDS.filter(f => visibleFields.includes(f.key))

    const addBtn = (
        <button onClick={onNewReservation}
            style={{ padding: '7px 16px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1.5px dashed var(--primary)', background: 'var(--primary-soft)', color: 'var(--primary)', transition: 'background 0.15s' }}>
            ＋ 新規予約を追加
        </button>
    )

    return (
        <div className="cal-day-panel" ref={panelRef}>
            <div className="cal-day-header">
                <h2 className="cal-day-title">📋 {dateLabel}の予約（{dayRes.length}件）</h2>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {pendingIds.length > 0 && (
                        <button disabled={bulkBusy} onClick={() => handleBulk(pendingIds, 'confirmed')}
                            style={{ padding: '5px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#c4a35a', color: '#fff' }}>
                            一括確定（{pendingIds.length}）
                        </button>
                    )}
                    {confirmedIds.length > 0 && (
                        <button disabled={bulkBusy} onClick={() => handleBulk(confirmedIds, 'completed')}
                            style={{ padding: '5px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#2c3e50', color: '#fff' }}>
                            一括来店済み（{confirmedIds.length}）
                        </button>
                    )}
                    {addBtn}
                </div>
            </div>

            {dayRes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    この日の予約はありません
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="cal-day-table">
                        <thead>
                            <tr>
                                {visibleCols.map(f => (
                                    <th key={f.key}>{f.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dayRes.map(r => (
                                <tr key={r.id} onClick={() => onResClick(r)}>
                                    {visibleCols.map(f => (
                                        <td key={f.key}>{renderCell(r, f.key)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ── 新規予約モーダル ──────────────────────────────────────────
function NewReservationModal({ date, menus, allOptions, onClose, onCreated }) {
    const bookableMenus = useMemo(() => menus.filter(m => !m.isCategory && m.active), [menus])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    // 名簿検索
    const [custQuery, setCustQuery] = useState('')
    const [custResults, setCustResults] = useState([])
    const [showCustList, setShowCustList] = useState(false)
    const custRef = useRef(null)

    const [form, setForm] = useState({
        lastName: '', firstName: '', phone: '', email: '',
        menuId: bookableMenus[0]?.id || '', time: '10:00',
        guests: 1, options: [], notes: '',
        massageDuration1: 0, massageDuration2: 0,
        priceOverride: null, // null = 自動計算、数値 = 手動上書き
    })

    const selectedMenu = menus.find(m => m.id === form.menuId)
    const duration = selectedMenu?.durations?.[0] || selectedMenu?.duration || 20

    // maxPeople: カテゴリ > メニュー > 設定のフォールバック（CLAUDE.md セクション6参照）
    const maxPeople = useMemo(() => {
        if (!selectedMenu) return 2
        if (selectedMenu.parentId) {
            const cat = menus.find(m => m.id === selectedMenu.parentId)
            if (cat?.maxPeople) return cat.maxPeople
        }
        return selectedMenu.maxPeople ?? 2
    }, [selectedMenu, menus])

    // isTimedResource オプションの合計時間
    const timedOptDuration = useMemo(() => {
        let total = 0
        form.options.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt?.isTimedResource) {
                total += (form.massageDuration1 || 0) + (form.massageDuration2 || 0)
            }
        })
        return total
    }, [form.options, form.massageDuration1, form.massageDuration2, allOptions])
    const totalDuration = duration + timedOptDuration

    // 自動計算金額: コース料金×人数 + 選択オプション料金×人数
    const autoPrice = useMemo(() => {
        const menuPrice = (selectedMenu?.price || 0) * form.guests
        const optPrice = form.options.reduce((sum, optId) => {
            const opt = allOptions.find(o => o.id === optId)
            return sum + (opt?.price || 0) * form.guests
        }, 0)
        return menuPrice + optPrice
    }, [selectedMenu, form.guests, form.options, allOptions])

    const totalPrice = form.priceOverride !== null ? form.priceOverride : autoPrice

    function upd(field, val) {
        setForm(prev => ({ ...prev, [field]: val, priceOverride: null })) // 変更時は自動計算に戻す
    }

    function toggleOption(optId) {
        setForm(prev => {
            const checked = prev.options.includes(optId)
            const newOpts = checked ? prev.options.filter(id => id !== optId) : [...prev.options, optId]
            // オプション解除時にマッサージ時間もリセット
            const opt = allOptions.find(o => o.id === optId)
            const resetTimed = checked && opt?.isTimedResource
            return {
                ...prev,
                options: newOpts,
                priceOverride: null,
                ...(resetTimed ? { massageDuration1: 0, massageDuration2: 0 } : {}),
            }
        })
    }

    // 名簿検索（debounce付き）
    useEffect(() => {
        if (!custQuery || custQuery.length < 1) { setCustResults([]); return }
        const timer = setTimeout(async () => {
            const results = await searchCustomers(custQuery)
            setCustResults(results)
            setShowCustList(results.length > 0)
        }, 300)
        return () => clearTimeout(timer)
    }, [custQuery])

    // 名簿外クリックで閉じる
    useEffect(() => {
        if (!showCustList) return
        function handler(e) { if (custRef.current && !custRef.current.contains(e.target)) setShowCustList(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showCustList])

    function selectCustomer(c) {
        setForm(prev => ({
            ...prev,
            lastName: c.lastName || '', firstName: c.firstName || '',
            phone: c.phone || '', email: c.email || '',
        }))
        setCustQuery('')
        setShowCustList(false)
    }

    async function handleSubmit() {
        if (!form.lastName || !form.time || !form.menuId) {
            setError('姓・時間・メニューは必須です')
            return
        }
        setSaving(true)
        setError('')
        const { priceOverride, ...formData } = form
        const res = await createReservation({
            ...formData, date, totalPrice: totalPrice, totalDuration,
            endTime: minToTime(timeToMin(form.time) + totalDuration),
        })
        setSaving(false)
        if (res.success) {
            onCreated()
        } else {
            setError(res.error || '予約の作成に失敗しました')
        }
    }

    const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
    const activeOpts = allOptions.filter(o => o.active)
    // isTimedResource なオプションで選択中のもの
    const timedOpts = activeOpts.filter(o => o.isTimedResource && form.options.includes(o.id))

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={onClose}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px' }}>新規予約を追加</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>{date}</p>
                </div>

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 名簿検索 */}
                    <div style={{ position: 'relative' }} ref={custRef}>
                        <label style={labelSt}>名簿から検索</label>
                        <input className="form-input" value={custQuery}
                            onChange={e => setCustQuery(e.target.value)}
                            onFocus={() => custResults.length > 0 && setShowCustList(true)}
                            placeholder="名前・電話番号・メールで検索..."
                            style={{ background: 'var(--bg-elevated)' }} />
                        {showCustList && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                maxHeight: 200, overflow: 'auto', marginTop: 4,
                            }}>
                                {custResults.map(c => (
                                    <div key={c.id} onClick={() => selectCustomer(c)}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <span><strong>{c.lastName} {c.firstName}</strong></span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone || c.email || ''}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* お客様名 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={labelSt}>姓 *</label>
                            <input className="form-input" value={form.lastName} onChange={e => upd('lastName', e.target.value)} placeholder="山田" />
                        </div>
                        <div>
                            <label style={labelSt}>名</label>
                            <input className="form-input" value={form.firstName} onChange={e => upd('firstName', e.target.value)} placeholder="花子" />
                        </div>
                    </div>

                    {/* 連絡先 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={labelSt}>電話番号</label>
                            <input className="form-input" value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="090-1234-5678" />
                        </div>
                        <div>
                            <label style={labelSt}>メール</label>
                            <input className="form-input" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="example@mail.com" />
                        </div>
                    </div>

                    {/* メニュー・時間・人数 */}
                    <div>
                        <label style={labelSt}>コース *</label>
                        <select className="form-input" value={form.menuId} onChange={e => upd('menuId', e.target.value)}>
                            {bookableMenus.map(m => <option key={m.id} value={m.id}>{m.icon || ''} {m.name} ({formatPrice(m.price || 0)})</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={labelSt}>開始時間 *</label>
                            <input className="form-input" type="time" value={form.time} onChange={e => upd('time', e.target.value)} />
                        </div>
                        <div>
                            <label style={labelSt}>人数（最大{maxPeople}名）</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {Array.from({ length: maxPeople }, (_, i) => i + 1).map(n => (
                                    <button key={n} type="button"
                                        className={`btn ${form.guests === n ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, padding: '6px 0', fontSize: '0.85rem' }}
                                        onClick={() => upd('guests', n)}>
                                        {n}名
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* オプション */}
                    {activeOpts.length > 0 && (
                        <div>
                            <label style={labelSt}>オプション</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {activeOpts.map(opt => {
                                    const checked = form.options.includes(opt.id)
                                    return (
                                        <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', cursor: 'pointer', padding: '4px 10px', borderRadius: 8, background: checked ? 'var(--primary-soft)' : 'var(--bg-elevated)', border: `1px solid ${checked ? 'var(--primary-light)' : 'var(--border)'}` }}>
                                            <input type="checkbox" checked={checked} onChange={() => toggleOption(opt.id)} style={{ display: 'none' }} />
                                            {opt.icon ?? ''} {opt.name}{opt.price > 0 ? ` (+${formatPrice(opt.price)})` : ''}
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 時間枠オプションの時間選択（チップUI） */}
                    {timedOpts.map(opt => {
                        const durs = opt.durations?.length > 0 ? opt.durations : [10, 20, 30]
                        const chipChoices = [0, ...durs]
                        return (
                            <div key={opt.id} style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8 }}>
                                <label style={{ ...labelSt, marginBottom: 8 }}>{opt.icon ?? ''} {opt.name} — 利用時間</label>
                                {form.guests >= 2 && <label style={{ ...labelSt, fontSize: '0.68rem', marginBottom: 4 }}>1人目</label>}
                                <div className="duration-select" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {chipChoices.map(d => (
                                        <button key={d} type="button"
                                            className={`duration-chip ${form.massageDuration1 === d ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, massageDuration1: d, priceOverride: null }))}>
                                            {d === 0 ? 'なし' : `${d}分`}
                                        </button>
                                    ))}
                                </div>
                                {form.guests >= 2 && (
                                    <>
                                        <label style={{ ...labelSt, fontSize: '0.68rem', marginTop: 10, marginBottom: 4 }}>2人目</label>
                                        <div className="duration-select" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {chipChoices.map(d => (
                                                <button key={d} type="button"
                                                    className={`duration-chip ${form.massageDuration2 === d ? 'active' : ''}`}
                                                    onClick={() => setForm(prev => ({ ...prev, massageDuration2: d, priceOverride: null }))}>
                                                    {d === 0 ? 'なし' : `${d}分`}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {(form.massageDuration1 > 0 || form.massageDuration2 > 0) && (
                                    <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                                        {opt.name}: {form.massageDuration1 + (form.guests >= 2 ? form.massageDuration2 : 0)}分
                                        {form.guests >= 2 && ' （チェアは1台のため順番にご利用）'}
                                    </p>
                                )}
                            </div>
                        )
                    })}

                    {/* 備考 */}
                    <div>
                        <label style={labelSt}>備考</label>
                        <textarea className="form-input" rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="特記事項があれば..." style={{ resize: 'vertical' }} />
                    </div>

                    {/* 金額（編集可能） */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flexShrink: 0 }}>合計金額</span>
                        {form.priceOverride !== null && (
                            <button onClick={() => setForm(prev => ({ ...prev, priceOverride: null }))}
                                style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                                自動計算に戻す
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>¥</span>
                        <input className="form-input" type="number" min="0" value={totalPrice}
                            onChange={e => setForm(prev => ({ ...prev, priceOverride: Number(e.target.value) }))}
                            style={{ width: 100, textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }} />
                    </div>

                    {error && <p style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>{error}</p>}
                </div>

                <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={saving}>キャンセル</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ minWidth: 120 }}>
                        {saving ? '作成中...' : '予約を作成'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── 予約詳細モーダル ──────────────────────────────────────────
function ReservationModal({ res, menus, allOptions, onClose, onUpdated }) {
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const bookableMenus = useMemo(() => menus.filter(m => !m.isCategory && m.active), [menus])

    useEffect(() => {
        setEditing(false)
        setEditForm({
            menuId: res.menuId || '',
            date: res.date || '',
            time: res.time || '',
            guests: res.guests || 1,
            options: [...(res.options || [])],
            notes: res.notes || '',
            totalPrice: res.totalPrice || 0,
            massageDuration1: res.massageDuration1 || 0,
            massageDuration2: res.massageDuration2 || 0,
        })
    }, [res.id])

    function recalcPrice(menuId, guests, options) {
        const menu = menus.find(m => m.id === menuId)
        let price = (menu?.price || 0) * guests
        options.forEach(optId => {
            const opt = allOptions.find(o => o.id === optId)
            if (opt) price += opt.price * guests
        })
        return price
    }

    function updateField(field, value) {
        setEditForm(prev => {
            const next = { ...prev, [field]: value }
            if (['menuId', 'guests', 'options'].includes(field)) {
                next.totalPrice = recalcPrice(
                    field === 'menuId' ? value : next.menuId,
                    field === 'guests' ? value : next.guests,
                    field === 'options' ? value : next.options
                )
            }
            return next
        })
    }

    async function handleSave() {
        const menu = menus.find(m => m.id === editForm.menuId)
        const dur = menu?.duration || (menu?.durations ? menu.durations[0] : 30) || 30
        // マッサージチェア含む全体の終了時刻を計算
        let totalMin = dur
        const hasMassage = editForm.options.includes('massage-chair')
        if (hasMassage) {
            totalMin += (editForm.massageDuration1 || 0) + (editForm.guests >= 2 ? (editForm.massageDuration2 || 0) : 0)
        }
        const endTime = minToTime(timeToMin(editForm.time) + totalMin)
        const updates = { ...editForm, endTime }
        // マッサージ無しの場合はリセット
        if (!hasMassage) {
            updates.massageDuration1 = 0
            updates.massageDuration2 = 0
        }
        await updateReservation(res.id, updates)
        onUpdated({ ...res, ...updates })
        setEditing(false)
    }

    async function handleStatusChange(newStatus) {
        const labels = { confirmed: '確定', cancelled: 'キャンセル', completed: '来店済み' }
        const msg = newStatus === 'cancelled'
            ? `${res.lastName}${res.firstName}様の予約をキャンセルしますか？`
            : `${res.lastName}${res.firstName}様の予約を「${labels[newStatus]}」に変更しますか？`
        if (!confirm(msg)) return
        if (newStatus === 'cancelled') {
            await cancelReservation(res.id)
        } else {
            await updateReservation(res.id, { status: newStatus })
        }
        onUpdated({ ...res, status: newStatus })
    }

    const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.88rem' }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40 }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{ background: 'white', borderRadius: 16, width: '92%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                {/* ヘッダー */}
                <div style={{ padding: '18px 24px 14px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)', borderRadius: '16px 16px 0 0', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{res.lastName} {res.firstName} 様</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2 }}>{res.id}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1rem' }}>×</button>
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                    {editing ? (
                        <div>
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>コース</FieldLabel>
                                <select className="form-input" value={editForm.menuId} onChange={e => updateField('menuId', e.target.value)} style={inputStyle}>
                                    {bookableMenus.map(m => <option key={m.id} value={m.id}>{m.icon || ''} {m.name} ({formatPrice(m.price || 0)})</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 10, marginBottom: 12 }}>
                                <div><FieldLabel>日付</FieldLabel><input type="date" className="form-input" value={editForm.date} onChange={e => updateField('date', e.target.value)} style={inputStyle} /></div>
                                <div><FieldLabel>時刻</FieldLabel><input type="time" className="form-input" value={editForm.time} step="600" onChange={e => updateField('time', e.target.value)} style={inputStyle} /></div>
                                <div><FieldLabel>人数</FieldLabel><input type="number" className="form-input" min="1" max="10" value={editForm.guests} onChange={e => updateField('guests', parseInt(e.target.value) || 1)} style={inputStyle} /></div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>オプション</FieldLabel>
                                {allOptions.filter(o => o.active).map(opt => {
                                    const checked = editForm.options.includes(opt.id)
                                    const isTimedOpt = opt.isTimedResource && (opt.durations || []).length > 0
                                    return (
                                        <div key={opt.id} style={{ marginBottom: isTimedOpt && checked ? 8 : 0 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                <input type="checkbox" checked={checked}
                                                    onChange={e => {
                                                        const newOpts = e.target.checked ? [...editForm.options, opt.id] : editForm.options.filter(id => id !== opt.id)
                                                        updateField('options', newOpts)
                                                        // 初回チェック時にデフォルト時間をセット
                                                        if (e.target.checked && isTimedOpt && !editForm.massageDuration1) {
                                                            setEditForm(f => ({ ...f, massageDuration1: opt.durations[0] || 20 }))
                                                        }
                                                    }} />
                                                {opt.icon} {opt.name} {opt.price > 0 && `(${formatPrice(opt.price)})`}
                                            </label>
                                            {/* 時間枠オプションの利用時間選択 */}
                                            {isTimedOpt && checked && (
                                                <div style={{ marginLeft: 28, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                                                        <span style={{ color: 'var(--text-muted)', minWidth: 50 }}>1人目</span>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            {opt.durations.map(d => (
                                                                <button key={d} type="button"
                                                                    style={{
                                                                        padding: '3px 10px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                                        border: '1px solid', transition: 'all 0.12s',
                                                                        borderColor: editForm.massageDuration1 === d ? 'var(--primary)' : 'var(--border)',
                                                                        background: editForm.massageDuration1 === d ? 'var(--primary)' : 'transparent',
                                                                        color: editForm.massageDuration1 === d ? '#fff' : 'var(--text-secondary)',
                                                                    }}
                                                                    onClick={() => setEditForm(f => ({ ...f, massageDuration1: d }))}>{d}分</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {editForm.guests >= 2 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                                                            <span style={{ color: 'var(--text-muted)', minWidth: 50 }}>2人目</span>
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                {opt.durations.map(d => (
                                                                    <button key={d} type="button"
                                                                        style={{
                                                                            padding: '3px 10px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                                            border: '1px solid', transition: 'all 0.12s',
                                                                            borderColor: editForm.massageDuration2 === d ? 'var(--primary)' : 'var(--border)',
                                                                            background: editForm.massageDuration2 === d ? 'var(--primary)' : 'transparent',
                                                                            color: editForm.massageDuration2 === d ? '#fff' : 'var(--text-secondary)',
                                                                        }}
                                                                        onClick={() => setEditForm(f => ({ ...f, massageDuration2: d }))}>{d}分</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel>合計金額</FieldLabel>
                                <input type="number" className="form-input" value={editForm.totalPrice} onChange={e => setEditForm(f => ({ ...f, totalPrice: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <FieldLabel>備考</FieldLabel>
                                <textarea className="form-input" rows="2" value={editForm.notes} onChange={e => updateField('notes', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>保存</button>
                                <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>やめる</button>
                            </div>
                            {res.status !== 'cancelled' && res.status !== 'completed' && (
                                <button className="btn btn-secondary" onClick={() => handleStatusChange('cancelled')}
                                    style={{ width: '100%', marginTop: 12, color: '#c0392b', borderColor: '#c0392b', fontSize: '0.82rem', padding: '8px 0' }}>
                                    この予約をキャンセルする
                                </button>
                            )}
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: '0.88rem' }}>
                                {[
                                    ['お客様', `${res.lastName} ${res.firstName}`],
                                    ['電話', res.phone || '—'],
                                    ['メール', res.email || '—'],
                                    ['コース', getMenuName(res.menuId, menus, { withIcon: true })],
                                    ['日時', `${formatDate(res.date)} ${res.time}〜`],
                                    ['人数', `${res.guests}名`],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ display: 'flex', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>{label}</span>
                                        <span style={{ flex: 1 }}>{value}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ width: 80, flexShrink: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>ステータス</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: getStatusColor(res.status) + '18', color: getStatusColor(res.status) }}>
                                        {getStatusLabel(res.status)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginTop: 16 }}>
                                <FieldLabel>オプション</FieldLabel>
                                {(res.options || []).length > 0 ? res.options.map(optId => {
                                    const opt = allOptions.find(o => o.id === optId)
                                    return opt ? <div key={optId} style={{ fontSize: '0.85rem', padding: '2px 0' }}>{opt.icon} {opt.name}</div> : null
                                }) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>なし</span>}
                            </div>
                            {res.notes && <div style={{ marginTop: 12 }}><FieldLabel>備考</FieldLabel><p style={{ fontSize: '0.85rem', margin: 0 }}>{res.notes}</p></div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '2px solid var(--primary)' }}>
                                <span style={{ fontWeight: 600 }}>合計金額</span>
                                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(res.totalPrice)}</span>
                            </div>
                            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {res.status === 'pending' && (
                                    <button className="btn" onClick={() => handleStatusChange('confirmed')}
                                        style={{ width: '100%', padding: 11, background: '#c4a35a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                        承認して確定する
                                    </button>
                                )}
                                {res.status === 'confirmed' && (
                                    <button className="btn" onClick={() => handleStatusChange('completed')}
                                        style={{ width: '100%', padding: 11, background: '#2c3e50', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                                        来店済みにする
                                    </button>
                                )}
                                {res.status !== 'cancelled' && res.status !== 'completed' && (
                                    <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ width: '100%' }}>編集</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── メインページ ──────────────────────────────────────────────
export default function CalendarView() {
    const [reservations, setReservations] = useState([])
    const [menus, setMenus] = useState([])
    const [allOptions, setAllOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [selectedDate, setSelectedDate] = useState(null)
    const [selectedRes, setSelectedRes] = useState(null)
    const [showNewRes, setShowNewRes] = useState(false)
    const [visibleFields, setVisibleFields] = useState(loadVisibleFields)
    const dayPanelRef = useRef(null)

    const today = new Date().toISOString().split('T')[0]

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [res, m, o] = await Promise.all([getReservations(), getMenus(), getOptions()])
            setReservations(res)
            setMenus(m)
            setAllOptions(o)
            setLoading(false)
        }
        load()
    }, [])

    // KPI サマリー
    const todayCount = useMemo(() =>
        reservations.filter(r => r.date === today && r.status !== 'cancelled').length,
        [reservations, today])
    const pendingCount = useMemo(() =>
        reservations.filter(r => r.status === 'pending').length,
        [reservations])
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    const monthRevenue = useMemo(() =>
        reservations
            .filter(r => r.date.startsWith(monthKey) && r.status !== 'cancelled')
            .reduce((sum, r) => sum + (r.totalPrice || 0), 0),
        [reservations, monthKey])

    // 日付選択時に詳細パネルへ自動スクロール
    useEffect(() => {
        if (selectedDate && dayPanelRef.current) {
            setTimeout(() => {
                dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 50)
        }
    }, [selectedDate])

    // 一括ステータス変更
    async function handleBulkStatusChange(ids, newStatus) {
        await Promise.all(ids.map(id => updateReservation(id, { status: newStatus })))
        setReservations(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: newStatus } : r))
    }

    // モーダル更新
    function handleResUpdated(updated) {
        setReservations(prev => prev.map(r => r.id === updated.id ? updated : r))
        setSelectedRes(updated)
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content"><div className="loading-spinner"></div></main>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, marginBottom: 4 }}>📅 予約台帳</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16, fontSize: '0.82rem' }}>月間カレンダーで予約状況を確認・管理できます</p>

                {/* KPI サマリーバー */}
                <div className="cal-summary-bar">
                    <div className="cal-summary-item">本日の予約<strong>{todayCount}件</strong></div>
                    {pendingCount > 0 && <div className="cal-summary-item" style={{ color: '#c4a35a' }}>⚠ 承認待ち<strong>{pendingCount}件</strong></div>}
                    <div className="cal-summary-item">{currentMonth.getMonth() + 1}月の売上<strong>¥{monthRevenue.toLocaleString()}</strong></div>
                </div>

                {/* 月間カレンダー */}
                <MonthlyCalendar
                    reservations={reservations}
                    menus={menus}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    onDayClick={setSelectedDate}
                    selectedDate={selectedDate}
                />

                {/* 日別詳細パネル */}
                {selectedDate && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <DisplaySettings visibleFields={visibleFields} onChange={setVisibleFields} />
                        </div>
                        <DayDetailPanel
                            date={selectedDate}
                            reservations={reservations}
                            menus={menus}
                            allOptions={allOptions}
                            visibleFields={visibleFields}
                            onResClick={setSelectedRes}
                            onBulkStatusChange={handleBulkStatusChange}
                            onNewReservation={() => setShowNewRes(true)}
                            panelRef={dayPanelRef}
                        />
                    </div>
                )}

                {/* 予約詳細モーダル */}
                {selectedRes && (
                    <ReservationModal
                        res={selectedRes}
                        menus={menus}
                        allOptions={allOptions}
                        onClose={() => setSelectedRes(null)}
                        onUpdated={handleResUpdated}
                    />
                )}

                {/* 新規予約モーダル */}
                {showNewRes && selectedDate && (
                    <NewReservationModal
                        date={selectedDate}
                        menus={menus}
                        allOptions={allOptions}
                        onClose={() => setShowNewRes(false)}
                        onCreated={async () => {
                            setShowNewRes(false)
                            const res = await getReservations()
                            setReservations(res)
                        }}
                    />
                )}
            </main>
        </div>
    )
}
