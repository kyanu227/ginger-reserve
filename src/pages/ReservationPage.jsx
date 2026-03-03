import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from '../components/DatePicker'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { getInitData, createReservation, formatPrice, checkRepeaterEmail } from '../lib/api'

const STEPS = ['コース選択', 'オプション', '日時選択', 'お客様情報', '確認']
const MASSAGE_DURATIONS = [10, 20, 30]

export default function ReservationPage() {
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [menus, setMenus] = useState([])
    const [options, setOptions] = useState([])
    const [slots, setSlots] = useState([])
    const [settings, setSettings] = useState({})
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState({})
    const [showCobathConfirm, setShowCobathConfirm] = useState(false)
    const [user, setUser] = useState(null)
    const [isRepeater, setIsRepeater] = useState(false)
    const [repeaterChecked, setRepeaterChecked] = useState(false)

    const [form, setForm] = useState({
        menuId: '',
        guests: 1,
        date: '',
        time: '',
        selectedOptions: [],
        massageDuration1: 20,  // 1人目のマッサージ時間
        massageDuration2: 20,  // 2人目のマッサージ時間
        lastName: '',
        firstName: '',
        phone: '',
        email: '',
        notes: ''
    })

    // Load data
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u)
            if (u && u.email) {
                setForm(prev => ({ ...prev, email: u.email }))
                try {
                    const res = await checkRepeaterEmail(u.email)
                    setIsRepeater(!!res?.isRepeater)
                } catch (err) {
                    console.error('Failed to check repeater status', err)
                }
            } else {
                setIsRepeater(false)
            }
            setRepeaterChecked(true)
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        async function load() {
            setLoading(true)
            const data = await getInitData(currentMonth)

            // Programmatically filter out obsolete menu IDs so the user doesn't have to worry about them showing up
            const activeMenus = data.menus.filter(x => x.active && x.id !== 'enzyme-regular' && x.id !== 'enzyme-bring')
            setMenus(activeMenus)

            setOptions(data.options.filter(x => x.active))
            setSlots(data.slotsResult?.slots || [])
            setSettings(data.settings || {})
            setLoading(false)
        }
        load()
    }, [currentMonth])

    const selectedMenu = useMemo(() => {
        const menu = menus.find(m => m.id === form.menuId)
        if (!menu) return null

        // Dynamic Pricing Logic for Enzyme Bath
        if (menu.id.startsWith('enzyme')) {
            const basePrice = isRepeater ? (Number(settings.repeaterDiscountAmount) || 2900) : 3900
            return {
                ...menu,
                price: basePrice,
                name: isRepeater ? (settings.repeaterMenuName || '酵素風呂 (2回目以降)') : '酵素風呂 (初回)',
            }
        }
        return menu
    }, [menus, form.menuId, isRepeater, settings])
    const hasMassageChair = form.selectedOptions.includes('massage-chair')

    // Total massage chair time (both guests combined for sequential use)
    const totalMassageTime = useMemo(() => {
        if (!hasMassageChair) return 0
        if (form.guests === 1) return form.massageDuration1
        return form.massageDuration1 + form.massageDuration2
    }, [hasMassageChair, form.guests, form.massageDuration1, form.massageDuration2])

    // Total estimated time for this booking
    const totalEstimatedTime = useMemo(() => {
        if (!selectedMenu) return 0
        return selectedMenu.duration + totalMassageTime
    }, [selectedMenu, totalMassageTime])

    // Available time slots for selected date with conflict info
    const slotsWithConflicts = useMemo(() => {
        if (!form.date) return []
        const dateSlots = slots.filter(s => s.date === form.date && (s.open === true || s.open === 'open' || s.open === 'request'))
            .sort((a, b) => a.time.localeCompare(b.time))

        return dateSlots.map(slot => {
            const hasOtherBooking = slot.booked > 0
            const remainingCapacity = slot.capacity - slot.booked
            const hasCapacity = remainingCapacity >= form.guests

            // Check if massage chair conflicts with other bookings
            const chairConflict = hasMassageChair && hasOtherBooking && slot.massageChairBooked

            return {
                ...slot,
                hasCapacity,
                hasOtherBooking,
                chairConflict,
                cobathing: hasOtherBooking && hasCapacity && form.guests === 1,
            }
        })
    }, [slots, form.date, form.guests, hasMassageChair])

    const availableSlots = useMemo(() => {
        return slotsWithConflicts.filter(s => s.hasCapacity)
    }, [slotsWithConflicts])

    // Find suggested alternative time (next slot without conflicts)
    const suggestedSlot = useMemo(() => {
        if (!form.time) return null
        const currentSlot = slotsWithConflicts.find(s => s.time === form.time)
        if (!currentSlot || (!currentSlot.chairConflict && !currentSlot.cobathing)) return null

        return slotsWithConflicts.find(s =>
            s.time !== form.time && s.hasCapacity && !s.hasOtherBooking && !s.chairConflict
        )
    }, [form.time, slotsWithConflicts])

    // Dates that have open slots
    const availableDates = useMemo(() => {
        const dates = new Set()
        slots.filter(s => (s.open === true || s.open === 'open' || s.open === 'request') && (s.capacity - s.booked) >= form.guests)
            .forEach(s => dates.add(s.date))
        return dates
    }, [slots, form.guests])

    // Filtered options based on selected menu
    const filteredOptions = useMemo(() => {
        let opts = options.filter(opt => {
            if (opt.constraint === 'enzyme-before') {
                return form.menuId?.startsWith('enzyme')
            }
            return true
        })

        // Add Enzyme Wear option for repeaters
        if (isRepeater && form.menuId?.startsWith('enzyme')) {
            opts = [
                {
                    id: 'enzyme-wear',
                    name: settings.repeaterOptionName || '自前酵素着持参（割引）',
                    price: Number(settings.repeaterOptionPrice) || -1000,
                    description: 'ご自身の酵素着をお持ちの方はチェックを入れてください',
                    icon: '👕',
                    constraint: '',
                    active: true
                },
                ...opts
            ]
        }
        return opts
    }, [options, form.menuId, isRepeater, settings])

    // Calculate total price
    const totalPrice = useMemo(() => {
        if (!selectedMenu) return 0
        let total = selectedMenu.price * form.guests
        form.selectedOptions.forEach(optId => {
            const opt = options.find(o => o.id === optId)
            if (opt) total += opt.price * form.guests
        })
        return total
    }, [selectedMenu, form.guests, form.selectedOptions, options])

    function validate(stepIndex) {
        const errs = {}
        if (stepIndex === 0) {
            if (!form.menuId) errs.menuId = 'コースを選択してください'
        }
        if (stepIndex === 2) {
            if (!form.date) errs.date = '日付を選択してください'
            if (!form.time) errs.time = '時間を選択してください'
        }
        if (stepIndex === 3) {
            if (!form.lastName.trim()) errs.lastName = '姓を入力してください'
            if (!form.firstName.trim()) errs.firstName = '名を入力してください'
            if (!form.phone.trim()) errs.phone = '電話番号を入力してください'
            if (!form.email.trim()) errs.email = 'メールアドレスを入力してください'
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '正しいメールアドレスを入力してください'
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    function nextStep() {
        if (validate(step)) {
            setStep(s => Math.min(s + 1, STEPS.length - 1))
            window.scrollTo(0, 0)
        }
    }

    function prevStep() {
        setStep(s => Math.max(s - 1, 0))
        setErrors({})
        window.scrollTo(0, 0)
    }

    async function handleSubmit() {
        setSubmitting(true)
        try {
            const result = await createReservation({
                menuId: form.menuId,
                guests: form.guests,
                date: form.date,
                time: form.time,
                options: form.selectedOptions,
                massageDuration1: hasMassageChair ? form.massageDuration1 : 0,
                massageDuration2: hasMassageChair && form.guests === 2 ? form.massageDuration2 : 0,
                lastName: form.lastName,
                firstName: form.firstName,
                phone: form.phone,
                email: form.email,
                notes: form.notes,
                totalPrice: totalPrice, // explicitly send the dynamic computed price
            })
            navigate('/confirm', {
                state: {
                    id: result.id,
                    totalPrice: result.totalPrice || totalPrice,
                    menu: selectedMenu,
                    form,
                    options: form.selectedOptions.map(id => options.find(o => o.id === id)).filter(Boolean)
                }
            })
        } catch {
            alert('予約の送信に失敗しました。もう一度お試しください。')
        } finally {
            setSubmitting(false)
        }
    }

    function toggleOption(optId) {
        setForm(prev => ({
            ...prev,
            selectedOptions: prev.selectedOptions.includes(optId)
                ? prev.selectedOptions.filter(id => id !== optId)
                : [...prev.selectedOptions, optId]
        }))
    }

    if (loading || !repeaterChecked) {
        return <main className="page"><div className="container"><div className="loading-spinner"></div></div></main>
    }

    return (
        <main className="page">
            <div className="container" style={{ maxWidth: 780 }}>
                {/* Hero */}
                <div className="hero-section">
                    <h1>🌿 ご予約</h1>
                    <p>心と体を癒す酵素風呂・よもぎ蒸しをお楽しみください</p>
                </div>

                {/* Stepper */}
                <div className="stepper">
                    {STEPS.map((s, i) => (
                        <div key={s} className={`stepper-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
                            <div className="stepper-number">{i < step ? '✓' : i + 1}</div>
                            <span className="stepper-label">{s}</span>
                        </div>
                    ))}
                </div>

                <div className="slide-up" key={step}>

                    {/* Step 0: Course Selection */}
                    {step === 0 && (
                        <div>
                            <h2 className="section-title">コースを選択してください</h2>
                            <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                                {menus.map(menu => (
                                    <div key={menu.id}>
                                        <div
                                            className={`card course-card ${form.menuId === menu.id ? 'selected' : ''}`}
                                            onClick={() => {
                                                setForm(prev => ({
                                                    ...prev,
                                                    menuId: menu.id,
                                                    selectedOptions: menu.id.startsWith('enzyme')
                                                        ? prev.selectedOptions
                                                        : prev.selectedOptions.filter(o => o !== 'massage-chair')
                                                }))
                                                setErrors({})
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                                <div>
                                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{menu.icon} {menu.name}</h3>
                                                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)', fontSize: '0.88rem', lineHeight: 1.6 }}>{menu.description}</p>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 'var(--sp-1)' }}>⏱ 約{menu.duration}分</p>
                                                </div>
                                                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: 'var(--sp-4)' }}>
                                                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(menu.price)}</span>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>/1名</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Guests — inline expansion under the selected card */}
                                        {form.menuId === menu.id && (
                                            <div className="guests-panel" onClick={e => e.stopPropagation()}>
                                                <div className="guests-panel-inner">
                                                    <div className="guests-panel-header">
                                                        <span className="guests-panel-icon">👥</span>
                                                        <div>
                                                            <h3>利用人数</h3>
                                                            <p>最大2名まで同時にご利用いただけます</p>
                                                        </div>
                                                    </div>
                                                    <div className="guests-panel-controls">
                                                        <button
                                                            className="guests-btn"
                                                            onClick={() => setForm(prev => ({ ...prev, guests: Math.max(1, prev.guests - 1), date: '', time: '' }))}
                                                            disabled={form.guests <= 1}
                                                        >−</button>
                                                        <div className="guests-count">
                                                            <span className="guests-count-number">{form.guests}</span>
                                                            <span className="guests-count-unit">名</span>
                                                        </div>
                                                        <button
                                                            className="guests-btn"
                                                            onClick={() => setForm(prev => ({ ...prev, guests: Math.min(2, prev.guests + 1), date: '', time: '' }))}
                                                            disabled={form.guests >= 2}
                                                        >+</button>
                                                    </div>
                                                    <div className="guests-panel-summary">
                                                        <span>{menu.icon} {menu.name}</span>
                                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(menu.price * form.guests)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>


                            {errors.menuId && <p className="form-error" style={{ marginTop: 'var(--sp-3)' }}>{errors.menuId}</p>}
                        </div>
                    )}

                    {/* Step 1: Options (moved before date/time) */}
                    {step === 1 && (
                        <div>
                            <h2 className="section-title">オプション（任意）</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', fontSize: '0.9rem' }}>
                                ご希望のオプションがあれば選択してください。選択しなくても次に進めます。
                            </p>

                            <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                                {filteredOptions.map(opt => (
                                    <div key={opt.id}>
                                        <div
                                            className={`option-card ${form.selectedOptions.includes(opt.id) ? 'selected' : ''}`}
                                            onClick={() => toggleOption(opt.id)}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                                                    <div className="option-checkbox">✓</div>
                                                    <div>
                                                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{opt.icon} {opt.name}</h3>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>{opt.description}</p>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: 'var(--sp-4)' }}>
                                                    {opt.price === 0 ? (
                                                        <span className="badge badge-success">無料</span>
                                                    ) : opt.price < 0 ? (
                                                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e74c3c' }}>
                                                            {formatPrice(opt.price)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                            {formatPrice(opt.price)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Massage chair duration selection */}
                                        {opt.id === 'massage-chair' && form.selectedOptions.includes('massage-chair') && (
                                            <div className="card slide-up" style={{ marginTop: 'var(--sp-3)', padding: 'var(--sp-4) var(--sp-5)' }}>
                                                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 'var(--sp-3)' }}>
                                                    💆 マッサージ時間を選択
                                                </p>

                                                {/* Guest 1 */}
                                                <div style={{ marginBottom: form.guests === 2 ? 'var(--sp-4)' : 0 }}>
                                                    {form.guests === 2 && (
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                                                            1人目
                                                        </p>
                                                    )}
                                                    <div className="duration-select">
                                                        {MASSAGE_DURATIONS.map(d => (
                                                            <button
                                                                key={d}
                                                                className={`duration-chip ${form.massageDuration1 === d ? 'active' : ''}`}
                                                                onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, massageDuration1: d })) }}
                                                            >
                                                                {d}分
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Guest 2 */}
                                                {form.guests === 2 && (
                                                    <div>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                                                            2人目
                                                        </p>
                                                        <div className="duration-select">
                                                            {MASSAGE_DURATIONS.map(d => (
                                                                <button
                                                                    key={d}
                                                                    className={`duration-chip ${form.massageDuration2 === d ? 'active' : ''}`}
                                                                    onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, massageDuration2: d })) }}
                                                                >
                                                                    {d}分
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="conflict-alert info" style={{ marginTop: 'var(--sp-4)', marginBottom: 0 }}>
                                                    <span className="conflict-alert-icon">ℹ️</span>
                                                    <div className="conflict-alert-body">
                                                        <strong>所要時間の目安</strong>
                                                        マッサージ{totalMassageTime}分 + 入浴{selectedMenu?.duration || 20}分
                                                        ＝ 合計約{totalEstimatedTime}分
                                                        {form.guests === 2 && (
                                                            <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                                                                ※ チェアは1台のため、お二人順番でご利用いただきます
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Date/Time Selection */}
                    {step === 2 && (
                        <div>
                            <h2 className="section-title">日時を選択してください</h2>

                            {/* Selection summary */}
                            <div className="card" style={{ marginBottom: 'var(--sp-6)', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                                <div>
                                    <span style={{ fontWeight: 600 }}>{selectedMenu?.icon} {selectedMenu?.name}</span>
                                    <span style={{ color: 'var(--text-muted)', margin: '0 var(--sp-2)' }}>×</span>
                                    <span style={{ fontWeight: 600 }}>{form.guests}名</span>
                                </div>
                                {totalEstimatedTime > 0 && (
                                    <span className="badge badge-muted">⏱ 約{totalEstimatedTime}分</span>
                                )}
                            </div>

                            <DatePicker
                                selected={form.date}
                                onSelect={(date) => setForm(prev => ({ ...prev, date, time: '' }))}
                                onMonthChange={(month) => setCurrentMonth(month)}
                                availableDates={availableDates}
                            />
                            {errors.date && <p className="form-error">{errors.date}</p>}

                            {form.date && (
                                <div style={{ marginTop: 'var(--sp-6)' }}>
                                    <h3 className="section-title">
                                        {new Date(form.date).getMonth() + 1}月{new Date(form.date).getDate()}日の空き時間
                                    </h3>
                                    {availableSlots.length === 0 ? (
                                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-8)' }}>
                                            この日に空き枠はありません
                                        </p>
                                    ) : (
                                        <div className="time-slots">
                                            {availableSlots.map(slot => {
                                                const isReq = slot.open === 'request'
                                                return (
                                                    <div key={slot.time} className="time-slot-wrapper">
                                                        <button
                                                            className={`time-slot ${form.time === slot.time ? 'selected' : ''} ${slot.cobathing || slot.chairConflict ? 'warning' : ''} ${isReq ? 'request' : ''}`}
                                                            onClick={() => {
                                                                setForm(prev => ({ ...prev, time: slot.time }))
                                                                setErrors({})
                                                                if (slot.cobathing) setShowCobathConfirm(true)
                                                            }}
                                                        >
                                                            {slot.time} {isReq && <span style={{ fontSize: '0.8rem', marginLeft: 4 }}>△</span>}
                                                        </button>
                                                        {slot.notice && (
                                                            <span className="time-slot-notice">{slot.notice.message}</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {errors.time && <p className="form-error">{errors.time}</p>}

                                    {/* Conflict warnings */}
                                    {form.time && (() => {
                                        const selectedSlot = slotsWithConflicts.find(s => s.time === form.time)
                                        if (!selectedSlot) return null

                                        return (
                                            <div className="slide-up" style={{ marginTop: 'var(--sp-4)' }}>
                                                {/* Co-bathing warning */}
                                                {selectedSlot.cobathing && (
                                                    <div className="conflict-alert">
                                                        <span className="conflict-alert-icon">🛁</span>
                                                        <div className="conflict-alert-body">
                                                            <strong>同時入浴のお知らせ</strong>
                                                            この時間帯は別のお客様のご予約がございます。同時入浴となりますがよろしいですか？
                                                            {suggestedSlot && (
                                                                <button
                                                                    className="suggest-btn"
                                                                    onClick={() => {
                                                                        setForm(prev => ({ ...prev, time: suggestedSlot.time }))
                                                                        setShowCobathConfirm(false)
                                                                    }}
                                                                >
                                                                    🕐 {suggestedSlot.time}〜 に変更する
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Massage chair conflict */}
                                                {selectedSlot.chairConflict && (
                                                    <div className="conflict-alert">
                                                        <span className="conflict-alert-icon">💆</span>
                                                        <div className="conflict-alert-body">
                                                            <strong>マッサージチェア使用中</strong>
                                                            この時間帯はマッサージチェアが別のお客様に使用されています。入浴開始時間がずれる可能性があります。
                                                            {suggestedSlot && (
                                                                <button
                                                                    className="suggest-btn"
                                                                    onClick={() => {
                                                                        setForm(prev => ({ ...prev, time: suggestedSlot.time }))
                                                                    }}
                                                                >
                                                                    🕐 {suggestedSlot.time}〜 がおすすめです
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Request Slot Notice */}
                                                {selectedSlot.open === 'request' && (
                                                    <div className="conflict-alert" style={{ background: 'rgba(230,126,34,0.08)', borderLeftColor: '#e67e22' }}>
                                                        <span className="conflict-alert-icon" style={{ color: '#e67e22' }}>△</span>
                                                        <div className="conflict-alert-body">
                                                            <strong style={{ color: '#e67e22' }}>リクエスト予約（承認待ち）</strong>
                                                            この枠はリクエスト予約となります。ご予約確定までご案内をお待ちください。
                                                        </div>
                                                    </div>
                                                )}

                                                {/* No conflicts - confirmation */}
                                                {!selectedSlot.cobathing && !selectedSlot.chairConflict && selectedSlot.open !== 'request' && (
                                                    <div className="conflict-alert info">
                                                        <span className="conflict-alert-icon">✅</span>
                                                        <div className="conflict-alert-body">
                                                            <strong>予約可能</strong>
                                                            {form.time}〜 他のお客様の予約はありません。
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Customer Info */}
                    {step === 3 && (
                        <div>
                            <h2 className="section-title">お客様情報</h2>
                            <div className="card">
                                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                                    <div>
                                        <label className="form-label">姓 <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" placeholder="山田" value={form.lastName}
                                            onChange={e => { setForm(prev => ({ ...prev, lastName: e.target.value })); setErrors(prev => ({ ...prev, lastName: '' })) }} />
                                        {errors.lastName && <p className="form-error">{errors.lastName}</p>}
                                    </div>
                                    <div>
                                        <label className="form-label">名 <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" placeholder="太郎" value={form.firstName}
                                            onChange={e => { setForm(prev => ({ ...prev, firstName: e.target.value })); setErrors(prev => ({ ...prev, firstName: '' })) }} />
                                        {errors.firstName && <p className="form-error">{errors.firstName}</p>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">電話番号 <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" type="tel" placeholder="090-1234-5678" value={form.phone}
                                        onChange={e => { setForm(prev => ({ ...prev, phone: e.target.value })); setErrors(prev => ({ ...prev, phone: '' })) }} />
                                    {errors.phone && <p className="form-error">{errors.phone}</p>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">メールアドレス <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" type="email" placeholder="yamada@example.com" value={form.email}
                                        onChange={e => { setForm(prev => ({ ...prev, email: e.target.value })); setErrors(prev => ({ ...prev, email: '' })) }} />
                                    {errors.email && <p className="form-error">{errors.email}</p>}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">備考・ご要望</label>
                                    <textarea className="form-input" rows="3" placeholder="気になることやご要望があればご記入ください"
                                        value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirmation */}
                    {step === 4 && (
                        <div>
                            <h2 className="section-title">予約内容の確認</h2>
                            <div className="card">
                                <table className="confirmation-table">
                                    <tbody>
                                        <tr><th>コース</th><td>{selectedMenu?.icon} {selectedMenu?.name}</td></tr>
                                        <tr><th>人数</th><td>{form.guests}名</td></tr>
                                        <tr><th>日時</th><td>{form.date} {form.time}〜</td></tr>
                                        {form.selectedOptions.length > 0 && (
                                            <tr>
                                                <th>オプション</th>
                                                <td>
                                                    {form.selectedOptions.map(id => {
                                                        const opt = options.find(o => o.id === id)
                                                        if (!opt) return null
                                                        if (opt.id === 'massage-chair') {
                                                            return (
                                                                <div key={id}>
                                                                    {opt.icon} {opt.name}
                                                                    {form.guests === 1
                                                                        ? `（${form.massageDuration1}分）`
                                                                        : `（1人目: ${form.massageDuration1}分、2人目: ${form.massageDuration2}分）`}
                                                                </div>
                                                            )
                                                        }
                                                        const priceDisplay = opt.price === 0 ? '無料' : formatPrice(opt.price)
                                                        return <div key={id}>{opt.icon} {opt.name} ({priceDisplay})</div>
                                                    })}
                                                </td>
                                            </tr>
                                        )}
                                        <tr><th>所要時間</th><td>約{totalEstimatedTime}分</td></tr>
                                        <tr><th>お名前</th><td>{form.lastName} {form.firstName}</td></tr>
                                        <tr><th>電話番号</th><td>{form.phone}</td></tr>
                                        <tr><th>メール</th><td>{form.email}</td></tr>
                                        {form.notes && <tr><th>備考</th><td>{form.notes}</td></tr>}
                                        <tr style={{ borderTop: '2px solid var(--primary)' }}>
                                            <th style={{ fontSize: '1.05rem' }}>合計金額</th>
                                            <td style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                {formatPrice(totalPrice)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {form.time && slotsWithConflicts.find(s => s.time === form.time)?.open === 'request' && (
                                    <div className="conflict-alert" style={{ background: 'rgba(230,126,34,0.08)', borderLeftColor: '#e67e22', marginTop: 'var(--sp-4)' }}>
                                        <span className="conflict-alert-icon" style={{ color: '#e67e22' }}>△</span>
                                        <div className="conflict-alert-body">
                                            <strong style={{ color: '#e67e22' }}>送信後に「承認待ち」となります</strong>
                                            このご予約はリクエスト予約です。送信直後はまだ確定しておりません。<br />
                                            店舗での確認と承認が完了次第、別途「ご予約確定」のメールをお送りします。
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>{/* end slide-up wrapper */}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-8)', paddingBottom: 'var(--sp-8)' }}>
                    {step > 0 ? (
                        <button className="btn btn-secondary" onClick={prevStep}>← 戻る</button>
                    ) : <div />}

                    {step < STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={nextStep}>次へ →</button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ minWidth: 200 }}>
                            {submitting ? '送信中...' : '✨ 予約を確定する'}
                        </button>
                    )}
                </div>
            </div>
        </main>
    )
}
