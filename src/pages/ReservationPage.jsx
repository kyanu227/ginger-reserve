/**
 * 予約フォーム（お客様向け）— 5ステップ構成
 * Step0: お客様情報 → Step1: コース選択 → Step2: オプション → Step3: 日時 → Step4: 確認・送信
 * 関連: api/reservations.js, api/menus.js, DatePicker.jsx
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from '../components/DatePicker'
import { getInitData, createReservation, formatPrice, checkRepeater, getBookedIntervals, getRanges, expandRangesToSlots, IS_DEMO, generateDemoRanges } from '../lib/api'
import { timeToMin, minToTime, DAY_LABELS } from '../lib/constants'
import { buildReservationPayload, buildReservationPreview, checkReservationPreviewAvailability } from '../application/useCases'
import { RESOURCE_IDS } from '../domain/reservation'

const STEPS = ['お客様情報', 'コース選択', 'オプション', '日時選択', '確認']
const MASSAGE_DURATIONS = [0, 10, 20, 30]
const _today = new Date(); const TODAY_STR = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`


// ── Step 0: お客様情報 ──
function StepCustomerInfo({ form, setForm, errors, setErrors }) {
    return (
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                    ※ 電話番号・メールアドレスのいずれかをご入力ください
                </p>
                <div className="form-group">
                    <label className="form-label">電話番号</label>
                    <input className="form-input" type="tel" placeholder="090-1234-5678" value={form.phone}
                        onChange={e => { setForm(prev => ({ ...prev, phone: e.target.value })); setErrors(prev => ({ ...prev, phone: '' })) }} />
                    {errors.phone && <p className="form-error">{errors.phone}</p>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">メールアドレス</label>
                    <input className="form-input" type="email" placeholder="yamada@example.com" value={form.email}
                        onChange={e => { setForm(prev => ({ ...prev, email: e.target.value })); setErrors(prev => ({ ...prev, email: '' })) }} />
                    {errors.email && <p className="form-error">{errors.email}</p>}
                </div>
            </div>
        </div>
    )
}

// ── Step 1: コース選択 ──
function StepMenuSelect({ menuGroups, form, selectedMenu, openCategoryId, setOpenCategoryId, selectMenu, menus, isRepeater, errors, setForm, setSelectedDuration, selectedDuration, renderMenuInfo, renderDurationSelector, renderGuestSelector }) {
    return (
        <div>
            <h2 className="section-title">コースを選択してください</h2>
            {isRepeater && (
                <div className="conflict-alert info" style={{ marginBottom: 'var(--sp-5)' }}>
                    <div className="conflict-alert-body">
                        <strong>リピーター価格が適用されます</strong>
                        いつもご利用ありがとうございます。リピーター割引が自動適用されています。
                    </div>
                </div>
            )}
            <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                {menuGroups.map(group => {
                    // ── スタンドアローン ──────────────────────────────────
                    if (group.type === 'standalone') {
                        const menu = group
                        return (
                            <div key={menu.id} className={`card course-card ${form.menuId === menu.id ? 'selected' : ''}`} onClick={() => selectMenu(menu.id)}>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{menu.icon && `${menu.icon} `}{menu.name}</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)', fontSize: '0.88rem', lineHeight: 1.6 }}>{menu.description}</p>
                                </div>
                                {renderMenuInfo(menu)}
                                {renderDurationSelector(menu)}
                                {renderGuestSelector(menu)}
                            </div>
                        )
                    }

                    // ── カテゴリ ─────────────────────────────────────────
                    const isOpen = openCategoryId === group.id
                    const hasSelected = group.children.some(c => c.id === form.menuId)

                    // 子が1件のみ → カテゴリを直接選択可能カードとして表示
                    if (group.children.length === 1) {
                        const child = group.children[0]
                        const catDesc = group.description?.trim()
                        const childDesc = child.description?.trim()
                        return (
                            <div key={group.id} className={`card course-card ${form.menuId === child.id ? 'selected' : ''}`} onClick={() => selectMenu(child.id)}>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{group.icon && `${group.icon} `}{group.name}</h3>
                                    {/* カテゴリ説明 → 子メニュー説明の順に表示。どちらかでもあれば表示 */}
                                    {catDesc && (
                                        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)', fontSize: '0.88rem', lineHeight: 1.6 }}>{catDesc}</p>
                                    )}
                                    {childDesc && childDesc !== catDesc && (
                                        <p style={{ color: 'var(--text-secondary)', marginTop: catDesc ? 'var(--sp-1)' : 'var(--sp-2)', fontSize: '0.85rem', lineHeight: 1.5, paddingLeft: 'var(--sp-2)', borderLeft: '2px solid var(--primary-light)' }}>{childDesc}</p>
                                    )}
                                </div>
                                {renderMenuInfo(child)}
                                {renderDurationSelector(child)}
                                {renderGuestSelector(child)}
                            </div>
                        )
                    }

                    // 子が複数 → タップで展開
                    return (
                        <div key={group.id}>
                            {/* カテゴリヘッダー */}
                            <div
                                className={`card course-card ${hasSelected ? 'selected' : ''}`}
                                onClick={() => setOpenCategoryId(prev => prev === group.id ? null : group.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                                    {group.icon && <span style={{ fontSize: '1.5rem' }}>{group.icon}</span>}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{group.name}</h3>
                                        {hasSelected ? (
                                            <p style={{ color: 'var(--primary)', fontSize: '0.82rem', marginTop: 2, fontWeight: 600 }}>
                                                ✓ {menus.find(m => m.id === form.menuId)?.name} を選択中
                                            </p>
                                        ) : (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
                                                {group.children.length}種類のコース — タップして選択
                                            </p>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)', transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
                                </div>
                            </div>

                            {/* 展開された子メニュー */}
                            {isOpen && (
                                <div className="slide-up" style={{ marginTop: 'var(--sp-2)', paddingLeft: 'var(--sp-3)', display: 'grid', gap: 'var(--sp-3)' }}>
                                    {group.children.map(child => (
                                        <div
                                            key={child.id}
                                            className={`card course-card ${form.menuId === child.id ? 'selected' : ''}`}
                                            onClick={() => selectMenu(child.id)}
                                            style={{
                                                borderLeft: form.menuId === child.id ? '3px solid var(--primary)' : '3px solid transparent',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                                                {child.icon && <span style={{ fontSize: '1.2rem', marginTop: 2 }}>{child.icon}</span>}
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{child.name}</h3>
                                                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)', fontSize: '0.85rem', lineHeight: 1.5 }}>{child.description}</p>
                                                </div>
                                            </div>
                                            {renderMenuInfo(child)}
                                            {renderDurationSelector(child)}
                                            {renderGuestSelector(child)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {errors.menuId && <p className="form-error" style={{ marginTop: 'var(--sp-3)' }}>{errors.menuId}</p>}
        </div>
    )
}

// ── Step 2: オプション ──
function StepOptions({ filteredOptions, form, setForm, selectedMenu, formatPrice, totalPrice, hasMassageChair, massageTime, totalEstimatedTime, toggleOption, selectedDuration, setStep }) {
    return (
        <div>
            <h2 className="section-title">オプション</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-5)', fontSize: '0.88rem' }}>
                ご希望があればタップで追加できます。選択しなくても次に進めます。
            </p>
            <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                {filteredOptions.map(opt => {
                    const isSelected = form.selectedOptions.includes(opt.id)
                    return (
                        <div key={opt.id}>
                            <div className={`option-card ${isSelected ? 'selected' : ''}`} onClick={() => toggleOption(opt.id)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{opt.name}</h3>
                                            {isSelected && (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-inverse)', background: 'var(--primary)', padding: '1px 8px', borderRadius: 'var(--r-full)' }}>選択済み</span>
                                            )}
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2, lineHeight: 1.5 }}>{opt.description}</p>
                                    </div>
                                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: 'var(--sp-4)' }}>
                                        {opt.price === 0 ? (
                                            <span className="badge badge-success">無料</span>
                                        ) : (
                                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(opt.price)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {opt.id === 'massage-chair' && isSelected && (
                                <div className="card slide-up" style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-4)' }}>
                                    <p className="form-label" style={{ marginBottom: 'var(--sp-3)' }}>
                                        {form.guests === 2 ? '1人目のマッサージ時間' : 'マッサージ時間を選択'}
                                    </p>
                                    <div className="duration-select">
                                        {(opt.durations?.length > 0 ? [0, ...opt.durations] : MASSAGE_DURATIONS).map(d => (
                                            <button key={d}
                                                className={`duration-chip ${form.massageDuration1 === d ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, massageDuration1: d })) }}>
                                                {d === 0 ? 'なし' : `${d}分`}
                                            </button>
                                        ))}
                                    </div>
                                    {form.guests === 2 && (
                                        <div style={{ marginTop: 'var(--sp-4)' }}>
                                            <p className="form-label" style={{ marginBottom: 'var(--sp-3)' }}>2人目のマッサージ時間</p>
                                            <div className="duration-select">
                                                {(opt.durations?.length > 0 ? [0, ...opt.durations] : MASSAGE_DURATIONS).map(d => (
                                                    <button key={d}
                                                        className={`duration-chip ${form.massageDuration2 === d ? 'active' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, massageDuration2: d })) }}>
                                                        {d === 0 ? 'なし' : `${d}分`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {massageTime > 0 && (
                                        <p style={{ marginTop: 'var(--sp-3)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            所要時間の目安：マッサージ{massageTime}分 + 入浴{selectedMenu?.duration || 20}分 = 合計約{totalEstimatedTime}分
                                            {form.guests === 2 && '（チェアは1台のため順番にご利用）'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <div style={{ marginTop: 'var(--sp-5)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>現在のご予算目安</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{formatPrice(totalPrice)}</span>
            </div>
            {hasMassageChair && (
                <div className="conflict-alert info" style={{ marginTop: 'var(--sp-4)' }}>
                    <div className="conflict-alert-body">
                        <strong>所要時間について</strong>
                        マッサージチェアを選択した場合、合計約{totalEstimatedTime}分となります。次のステップで選択できる時間帯が絞られます。
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Step 3: 日時選択 ──
function StepDateTime({ form, setForm, pickedHour, setPickedHour, dayRanges, hourOptions, minuteOptions, selectedSlotData, currentMonth, setCurrentMonth, availableDates, errors, pickDate, pickHour, pickMinute, setStep }) {
    return (
        <div>
            <h2 className="section-title">日時を選択してください</h2>

            {/* カレンダー — 常に表示 */}
            <DatePicker
                selected={form.date}
                onSelect={pickDate}
                onMonthChange={setCurrentMonth}
                availableDates={availableDates}
            />
            {errors.date && <p className="form-error">{errors.date}</p>}

            {/* 時間帯＋分 — 日付選択後にカレンダー下に展開 */}
            {form.date && (
                <div className="slide-up" style={{ marginTop: 'var(--sp-4)' }}>
                    <p className="dt-phase-label">
                        {new Date(form.date + 'T00:00:00').getMonth() + 1}月{new Date(form.date + 'T00:00:00').getDate()}日 — 開始時刻を選んでください
                    </p>
                    {hourOptions.length === 0 ? (
                        <div className="dt-empty">この日に選択可能な時間はありません</div>
                    ) : (
                        <div className="dt-hour-grid">
                            {hourOptions.map(({ hour, status }) => (
                                <React.Fragment key={hour}>
                                    <button
                                        className={`dt-hour-btn dt-btn-${status}${pickedHour === hour ? ' dt-btn-active' : ''}`}
                                        onClick={() => pickHour(hour, status)}>
                                        <span className="dt-hour-num">{String(hour).padStart(2, '0')}</span>
                                        <span className="dt-hour-unit">時台</span>
                                        {status === 'gray' && <span className="dt-gray-badge">チェアなし</span>}
                                    </button>
                                    {pickedHour === hour && (
                                        <div className="dt-minute-inline slide-up">
                                            {minuteOptions.length === 0 ? (
                                                <span className="dt-empty-sm">選択可能な枠がありません</span>
                                            ) : minuteOptions.map(({ min, time, status: mStatus }) => (
                                                <button key={min}
                                                    className={`dt-minute-btn dt-btn-${mStatus}${form.time === time ? ' dt-btn-selected' : ''}`}
                                                    onClick={() => pickMinute(time, mStatus)}>
                                                    {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}
                                                    {mStatus === 'gray' && <span className="dt-gray-badge">チェアなし</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    {hourOptions.some(o => o.status === 'gray') && (
                        <p className="dt-gray-note-text">
                            グレーの時間帯はマッサージチェアなしの場合のみ選択できます。<button className="dt-link-btn" onClick={() => { setStep(2); window.scrollTo(0,0) }}>オプションを変更する</button>
                        </p>
                    )}

                    {/* 選択済み時刻の確認ボックス */}
                    {form.time && (
                        <div className="dt-selected-box slide-up">
                            <div className="dt-selected-inner">
                                <span className="dt-selected-label">予約時間</span>
                                <span className="dt-selected-val">{form.date}（{DAY_LABELS[new Date(form.date+'T00:00:00').getDay()]}） {form.time}〜</span>
                            </div>
                            {selectedSlotData?.status === 'request' && (
                                <div className="conflict-alert" style={{ marginTop: 'var(--sp-3)', background: 'rgba(230,126,34,0.08)', borderLeftColor: '#e67e22' }}>
                                    <span className="conflict-alert-icon" style={{ color: '#e67e22' }}>△</span>
                                    <div className="conflict-alert-body">
                                        <strong style={{ color: '#e67e22' }}>リクエスト予約（承認待ち）</strong>
                                        この枠はリクエスト予約となります。
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {errors.time && <p className="form-error">{errors.time}</p>}
                </div>
            )}
        </div>
    )
}

// ── Step 4: 確認 ──
function StepConfirmation({ form, setForm, selectedMenu, menus, options, filteredOptions, formatPrice, totalPrice, totalEstimatedTime, selectedSlotData, hasMassageChair, bookedIntervals, totalDuration, reservationPreview }) {
    const renderMenuInfo = (menu) => (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>¥{menu.price.toLocaleString()} / 1名</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>約{menu.duration}分</span>
        </div>
    )

    return (
        <div>
            <h2 className="section-title">予約内容の確認</h2>
            <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">備考・ご要望</label>
                    <textarea className="form-input" rows="3" placeholder="気になることやご要望があればご記入ください"
                        value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                </div>
            </div>
            <div className="card">
                <table className="confirmation-table">
                    <tbody>
                        <tr><th>コース</th><td>{selectedMenu?.name}</td></tr>
                        <tr><th>人数</th><td>{form.guests}名</td></tr>
                        <tr><th>入浴開始</th><td>{form.date}（{DAY_LABELS[new Date(form.date+'T00:00:00').getDay()]}） {form.time}〜</td></tr>
                        {reservationPreview?.arrivalTime && reservationPreview.arrivalTime !== form.time && (
                            <tr><th>来店目安</th><td>{reservationPreview.arrivalTime}（オプション利用時間を含む）</td></tr>
                        )}
                        {reservationPreview?.bathEndTime && (
                            <tr><th>入浴終了目安</th><td>{reservationPreview.bathEndTime}</td></tr>
                        )}
                        {form.selectedOptions.length > 0 && (
                            <tr>
                                <th>オプション</th>
                                <td>
                                    {form.selectedOptions.map(id => {
                                        const opt = options.find(o => o.id === id) || filteredOptions.find(o => o.id === id)
                                        if (!opt) return null
                                        if (opt.id === 'massage-chair') {
                                            return <div key={id}>{opt.name}{form.guests === 1 ? `（${form.massageDuration1}分）` : `（1人目: ${form.massageDuration1}分、2人目: ${form.massageDuration2}分）`}</div>
                                        }
                                        return <div key={id}>{opt.name}（{opt.price === 0 ? '無料' : formatPrice(opt.price)}）</div>
                                    })}
                                </td>
                            </tr>
                        )}
                        <tr><th>所要時間</th><td>約{totalEstimatedTime}分</td></tr>
                        <tr><th>お名前</th><td>{form.lastName} {form.firstName}</td></tr>
                        {form.phone && <tr><th>電話番号</th><td>{form.phone}</td></tr>}
                        {form.email && <tr><th>メール</th><td>{form.email}</td></tr>}
                        {form.notes && <tr><th>備考</th><td>{form.notes}</td></tr>}
                        <tr style={{ borderTop: '2px solid var(--primary)' }}>
                            <th style={{ fontSize: '1.05rem' }}>合計金額</th>
                            <td style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(totalPrice)}</td>
                        </tr>
                    </tbody>
                </table>

                {bookedIntervals.some(r => {
                    const s = timeToMin(form.time)
                    const e = s + totalDuration
                    return r.startMin < e && s < r.endMin
                }) && (
                    <div className="conflict-alert" style={{ marginTop: 'var(--sp-4)' }}>
                        <span className="conflict-alert-icon">ℹ</span>
                        <div className="conflict-alert-body">
                            <strong>同時入浴のお知らせ</strong>
                            この時間帯は別のお客様のご予約がございます。同時入浴となります。
                        </div>
                    </div>
                )}
                {selectedSlotData?.massageChairBooked && hasMassageChair && (
                    <div className="conflict-alert" style={{ marginTop: 'var(--sp-4)' }}>
                        <span className="conflict-alert-icon">ℹ</span>
                        <div className="conflict-alert-body">
                            <strong>マッサージチェア使用中</strong>
                            この時間帯はマッサージチェアが別のお客様に使用されています。入浴開始時間がずれる可能性があります。
                        </div>
                    </div>
                )}
                {selectedSlotData?.status === 'request' && (
                    <div className="conflict-alert" style={{ background: 'rgba(230,126,34,0.08)', borderLeftColor: '#e67e22', marginTop: 'var(--sp-4)' }}>
                        <span className="conflict-alert-icon" style={{ color: '#e67e22' }}>△</span>
                        <div className="conflict-alert-body">
                            <strong style={{ color: '#e67e22' }}>送信後に「承認待ち」となります</strong>
                            このご予約はリクエスト予約です。送信直後はまだ確定しておりません。店舗での確認と承認が完了次第、別途「ご予約確定」のメールをお送りします。
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


export default function ReservationPage() {
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [menus, setMenus] = useState([])
    const [options, setOptions] = useState([])
    const [slots, setSlots] = useState([])
    const [ranges, setRanges] = useState([])
    const [resources, setResources] = useState([])
    const [settings, setSettings] = useState({})
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState({})
    const [isRepeater, setIsRepeater] = useState(false)
    const [visitCount, setVisitCount] = useState(0)
    const [repeaterLoading, setRepeaterLoading] = useState(false)
    const [openCategoryId, setOpenCategoryId] = useState(null)
    const [bookedIntervals, setBookedIntervals] = useState([]) // {startMin, endMin, guests, menuId, options, massageDuration1, massageDuration2}[]
    const [selectedDuration, setSelectedDuration] = useState(null) // メニューの所要時間選択（複数選択肢がある場合）

    // Time picker phases
    const [pickedHour, setPickedHour] = useState(null)

    const [form, setForm] = useState({
        menuId: '',
        guests: 1,
        date: '',
        time: '',
        selectedOptions: [],
        massageDuration1: 20,
        massageDuration2: 20,
        lastName: '',
        firstName: '',
        phone: '',
        email: '',
        notes: ''
    })

    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    // 初回ロード: メニュー・オプション・設定 + 当月スロット
    useEffect(() => {
        async function load() {
            setLoading(true)
            const data = await getInitData(currentMonth)
            const VISIBILITY_DEFAULTS = {
                'enzyme-set': 'all', 'enzyme-rental': 'repeater',
                'enzyme-solo': 'repeater', 'yomogi': 'all',
            }
            const activeMenus = data.menus
                .filter(x => x.active)
                .map(m => ({ ...m, visibility: m.visibility || VISIBILITY_DEFAULTS[m.id] || 'all' }))
            setMenus(activeMenus)
            setOptions(data.options.filter(x => x.active))
            setResources(data.resources || [])
            setSlots(data.slotsResult?.slots || [])
            setRanges(data.slotsResult?.ranges || [])
            setSettings(data.settings || {})
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 月切り替え時: スロットデータのみ再取得（メニュー等はリロードしない）
    const initialMonthRef = React.useRef(currentMonth)
    useEffect(() => {
        if (currentMonth === initialMonthRef.current) return // 初回は上のuseEffectで取得済み
        let cancelled = false
        async function loadSlots() {
            const ranges = IS_DEMO ? generateDemoRanges(currentMonth) : await getRanges(currentMonth)
            if (cancelled) return
            setRanges(ranges)
            setSlots(expandRangesToSlots(ranges))
        }
        loadSlots()
        return () => { cancelled = true }
    }, [currentMonth])

    // 日付変更時に予約済みインターバルを取得
    useEffect(() => {
        if (!form.date) { setBookedIntervals([]); return }
        getBookedIntervals(form.date).then(setBookedIntervals).catch(() => setBookedIntervals([]))
    }, [form.date])

    // ===== Computed =====
    const visibleMenus = useMemo(() => menus.filter(menu => {
        if (menu.isCategory) return !!menu.active  // カテゴリは常に表示
        const minVis = menu.minVisits !== undefined ? menu.minVisits
            : menu.visibility === 'firstTime' ? -1 : menu.visibility === 'repeater' ? 1 : 0
        if (minVis === -1) return visitCount === 0
        if (minVis >= 1)  return visitCount >= minVis
        return true
    }), [menus, visitCount])

    // カテゴリ→子メニューの入れ子グループ（backward compat: カテゴリなしならenzyme-*でグループ化）
    const menuGroups = useMemo(() => {
        const cats = visibleMenus.filter(m => m.isCategory)
        if (cats.length > 0) {
            const result = cats
                .map(cat => ({
                    type: 'category', ...cat,
                    children: menus.filter(m => m.parentId === cat.id && !m.isCategory && visibleMenus.some(v => v.id === m.id))
                }))
                .filter(g => g.children.length > 0)
            const standalone = visibleMenus.filter(m => !m.isCategory && !m.parentId)
            return [...result, ...standalone.map(m => ({ type: 'standalone', ...m }))]
        }
        // 旧方式 backward compat
        const enzyme = visibleMenus.filter(m => m.id.startsWith('enzyme'))
        const others = visibleMenus.filter(m => !m.id.startsWith('enzyme'))
        const result = []
        if (enzyme.length === 1) result.push({ type: 'standalone', ...enzyme[0] })
        else if (enzyme.length > 1) result.push({ type: 'category', id: '_enzyme', name: '酵素風呂', icon: '🌿', children: enzyme })
        others.forEach(m => result.push({ type: 'standalone', ...m }))
        return result
    }, [visibleMenus, menus])
    const selectedMenu = useMemo(() => menus.find(m => m.id === form.menuId) || null, [menus, form.menuId])
    const hasMassageChair = form.selectedOptions.includes('massage-chair')

    const maxConcurrentGuests = parseInt(settings?.['最大同時人数'] || '2')
    const baseDuration = selectedDuration
        ?? selectedMenu?.durations?.[0]
        ?? selectedMenu?.duration
        ?? 0
    const massageTime = useMemo(() => {
        if (!hasMassageChair) return 0
        return form.massageDuration1 + (form.guests === 2 ? form.massageDuration2 : 0)
    }, [hasMassageChair, form.massageDuration1, form.massageDuration2, form.guests])
    const reservationPreview = useMemo(() => buildReservationPreview({
        form,
        menus,
        options,
        settings,
        resources,
        selectedDuration,
        visitCount,
    }), [form, menus, options, settings, resources, selectedDuration, visitCount])

    const totalDuration = reservationPreview.totalDuration || (baseDuration + massageTime)
    const totalEstimatedTime = totalDuration

    // 選択日のオープン範囲（{ date, startTime, endTime, status }[]）
    const dayRanges = useMemo(() => {
        if (!form.date) return []
        const isToday = form.date === TODAY_STR
        return ranges
            .filter(r => r.date === form.date && (r.status === 'open' || r.status === 'request'))
            .map(r => ({
                ...r,
                // 当日予約は自動的にリクエスト制
                status: isToday && r.status === 'open' ? 'request' : r.status
            }))
    }, [ranges, form.date])

    // 選択中の予約時刻が属するオープン範囲（'request' 判定用）
    const selectedSlotData = useMemo(() => {
        if (!form.date || !form.time) return null
        const selectedMin = timeToMin(form.time)
        return dayRanges.find(r => {
            const rs = timeToMin(r.startTime)
            const re = timeToMin(r.endTime)
            return selectedMin >= rs && selectedMin < re
        }) || null
    }, [dayRanges, form.date, form.time])

    // 時間ベース重複チェック: 既存予約合計人数 + 新規 > maxPeople なら衝突
    // カテゴリ配下の子メニューは物理的に同じスペースを共有するため、兄弟メニューの予約も合算する
    // 優先順位: カテゴリの maxPeople > 子メニューの maxPeople > 設定の最大同時人数
    function candidateAvailability(startMin, { includeMassage = true } = {}) {
        const candidateForm = {
            ...form,
            time: minToTime(startMin),
            selectedOptions: includeMassage
                ? form.selectedOptions
                : form.selectedOptions.filter(id => id !== 'massage-chair'),
        }
        return checkReservationPreviewAvailability({
            form: candidateForm,
            menus,
            options,
            settings,
            resources,
            ranges: dayRanges,
            reservations: bookedIntervals,
            selectedDuration,
            visitCount,
        })
    }

    function hasConflict(startMin, _durationMin, { includeMassage = false } = {}) {
        if (!selectedMenu) return false
        const result = candidateAvailability(startMin, { includeMassage })
        return !result.ok && result.resourceId && result.resourceId !== RESOURCE_IDS.MASSAGE_CHAIR
    }

    // マッサージチェアの時間帯重複チェック
    function hasChairConflict(chairStartMin, _massDuration) {
        if (!hasMassageChair || massageTime <= 0) return false
        const result = candidateAvailability(chairStartMin, { includeMassage: true })
        return !result.ok && result.resourceId === RESOURCE_IDS.MASSAGE_CHAIR
    }

    // 時間ベース範囲チェック: [startMin, startMin+duration] 全体がオープン範囲に収まるか
    // ※ 開始時刻の存在だけでなく終了時刻まで範囲内かを検証（旧スロット方式の名残を排除）
    function fitsInOpenRange(startMin, _duration, { includeMassage = true } = {}) {
        return candidateAvailability(startMin, { includeMassage }).preview.availability.ok
    }

    // Hour options for time picker
    const hourOptions = useMemo(() => {
        if (!form.date || !selectedMenu) return []
        const map = {}
        const hourSet = new Set()
        dayRanges.forEach(r => {
            const h0 = Math.floor(timeToMin(r.startTime) / 60)
            const h1 = Math.floor((timeToMin(r.endTime) - 1) / 60)
            for (let h = h0; h <= h1; h++) hourSet.add(h)
        })
        ;[...hourSet].sort((a, b) => a - b).forEach(h => {
            for (const snap of [0, 10, 20, 30, 40, 50]) {
                const startMin = h * 60 + snap
                if (!fitsInOpenRange(startMin, totalDuration)) continue
                const chairConflict = hasMassageChair && massageTime > 0 && hasChairConflict(startMin, massageTime)
                if (!hasConflict(startMin, totalDuration) && !chairConflict) { map[h] = 'available'; break }
            }
            // gray（チェアなし）= チェアが他の予約で埋まっているが入浴のみなら予約可能な枠
            // ※ 単純に営業時間が短くて合計時間が入らない場合はgrayにしない（非表示）
            if (!map[h] && hasMassageChair && massageTime > 0) {
                for (const snap of [0, 10, 20, 30, 40, 50]) {
                    const startMin = h * 60 + snap
                    if (!fitsInOpenRange(startMin, baseDuration, { includeMassage: false })) continue
                    if (!hasConflict(startMin, baseDuration, { includeMassage: false }) && hasChairConflict(startMin, massageTime)) {
                        map[h] = 'gray'; break
                    }
                }
            }
        })
        return Object.entries(map)
            .map(([h, s]) => ({ hour: parseInt(h), status: s }))
            .sort((a, b) => a.hour - b.hour)
    }, [form.date, form.guests, dayRanges, totalDuration, baseDuration, bookedIntervals, hasMassageChair, massageTime, selectedMenu, maxConcurrentGuests]) // eslint-disable-line react-hooks/exhaustive-deps

    // Minute options for time picker
    const minuteOptions = useMemo(() => {
        if (pickedHour === null || !form.date) return []
        return [0, 10, 20, 30, 40, 50].map(min => {
            const startMin = pickedHour * 60 + min
            const slotTime = minToTime(startMin)
            const chairConflict = hasMassageChair && massageTime > 0 && hasChairConflict(startMin, massageTime)
            if (fitsInOpenRange(startMin, totalDuration) && !hasConflict(startMin, totalDuration) && !chairConflict)
                return { min, time: slotTime, status: 'available' }
            // gray = チェアが実際に他の予約で埋まっている場合のみ（時間不足は非表示）
            if (hasMassageChair && massageTime > 0 && fitsInOpenRange(startMin, baseDuration, { includeMassage: false }) && !hasConflict(startMin, baseDuration, { includeMassage: false }) && chairConflict)
                return { min, time: slotTime, status: 'gray' }
            return { min, status: 'hidden' }
        }).filter(o => o.status !== 'hidden')
    }, [pickedHour, form.date, form.guests, dayRanges, totalDuration, baseDuration, bookedIntervals, hasMassageChair, massageTime, maxConcurrentGuests]) // eslint-disable-line react-hooks/exhaustive-deps

    // 予約可能日（選択メニューの所要時間がオープン範囲に収まる日）
    const availableDates = useMemo(() => {
        const dates = new Set()
        ranges.forEach(r => {
            if (!(r.status === 'open' || r.status === 'request')) return
            if (!selectedMenu) { dates.add(r.date); return }
            const rs = timeToMin(r.startTime)
            const re = timeToMin(r.endTime)
            // 範囲の長さがベース所要時間以上あれば予約可能日と判定
            if (re - rs >= baseDuration) dates.add(r.date)
        })
        return dates
    }, [ranges, selectedMenu, baseDuration])

    // 酵素風呂 or よもぎ蒸し系メニューかどうかを判定（enzyme-before 制約の表示条件）
    function isEnzymeRelated(menuId) {
        if (!menuId) return false
        if (menuId.startsWith('enzyme') || menuId.startsWith('yomogi')) return true
        const m = menus.find(x => x.id === menuId)
        const parent = m?.parentId ? menus.find(x => x.id === m.parentId) : null
        return parent?.id?.includes('enzyme') || parent?.id?.includes('yomogi')
    }

    // enzyme-before は運用ルール名（入浴前に使用）であって表示制限ではない → 全メニューで表示
    const filteredOptions = useMemo(() => options.filter(() => true), [options])

    const totalPrice = reservationPreview.totalPrice || 0

    // ===== Validation =====
    function validate(stepIndex) {
        const errs = {}
        if (stepIndex === 0) {
            if (!form.lastName.trim()) errs.lastName = '姓を入力してください'
            if (!form.firstName.trim()) errs.firstName = '名を入力してください'
            const hasPhone = form.phone.trim().length > 0
            const hasEmail = form.email.trim().length > 0
            if (!hasPhone && !hasEmail) {
                errs.phone = '電話番号またはメールアドレスのいずれかを入力してください'
                errs.email = '電話番号またはメールアドレスのいずれかを入力してください'
            }
            if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
                errs.email = '正しいメールアドレスを入力してください'
            }
        }
        if (stepIndex === 1) {
            if (!form.menuId) errs.menuId = 'コースを選択してください'
        }
        if (stepIndex === 3) {
            if (!form.date) errs.date = '日付を選択してください'
            if (!form.time) errs.time = '時間を選択してください'
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    async function handleCustomerInfoSubmit() {
        if (!validate(0)) return
        setRepeaterLoading(true)
        try {
            const res = await checkRepeater({ email: form.email, phone: form.phone, lastName: form.lastName, firstName: form.firstName })
            const repeaterResult = !!res?.isRepeater
            // visitCount が未設定の古い顧客レコードでも isRepeater=true なら最低1回扱い
            // `||` を使う: visitCount=0（未設定の古いレコード）でも isRepeater=true なら1扱い
            const vc = res?.visitCount || (repeaterResult ? 1 : 0)
            setIsRepeater(repeaterResult)
            setVisitCount(vc)
        } catch {
            setIsRepeater(false)
        } finally { setRepeaterLoading(false) }
        setForm(prev => ({ ...prev, menuId: '', selectedOptions: [] }))
        setOpenCategoryId(null)
        setStep(1)
        window.scrollTo(0, 0)
    }

    function nextStep() {
        if (step === 0) { handleCustomerInfoSubmit(); return }
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
                ...buildReservationPayload({
                    form: {
                        ...form,
                        massageDuration1: hasMassageChair ? form.massageDuration1 : 0,
                        massageDuration2: hasMassageChair && form.guests === 2 ? form.massageDuration2 : 0,
                    },
                    menus,
                    options,
                    settings,
                    resources,
                    selectedDuration,
                    visitCount,
                }),
            })
            if (!result?.success) {
                alert(result?.error || '予約の送信に失敗しました。別の日時をお試しください。')
                return
            }
            navigate('/confirm', {
                state: {
                    id: result.id, totalPrice: result.totalPrice || totalPrice,
                    menu: selectedMenu, form: { ...form, resourceUsages: reservationPreview.resourceUsages },
                    options: form.selectedOptions.map(id => options.find(o => o.id === id) || filteredOptions.find(o => o.id === id)).filter(Boolean)
                }
            })
        } catch {
            alert('予約の送信に失敗しました。もう一度お試しください。')
        } finally { setSubmitting(false) }
    }

    function toggleOption(optId) {
        setForm(prev => ({
            ...prev,
            selectedOptions: prev.selectedOptions.includes(optId)
                ? prev.selectedOptions.filter(id => id !== optId)
                : [...prev.selectedOptions, optId]
        }))
    }

    function selectMenu(menuId) {
        setForm(prev => ({ ...prev, menuId, selectedOptions: prev.selectedOptions }))
        setSelectedDuration(null)
        setErrors({})
    }

    // ===== Date/Time picker handlers =====
    function pickDate(date) {
        setForm(prev => ({ ...prev, date, time: '' }))
        setPickedHour(null)

        setErrors(prev => ({ ...prev, date: '', time: '' }))
    }

    function pickHour(hour, status) {
        if (status === 'gray') return
        setPickedHour(prev => prev === hour ? null : hour)
        setForm(prev => ({ ...prev, time: '' }))
    }

    function pickMinute(time, status) {
        if (status === 'gray') return
        setForm(prev => ({ ...prev, time }))
        setErrors(prev => ({ ...prev, time: '' }))
    }

    if (loading) {
        return <main className="page"><div className="container"><div className="loading-spinner"></div></div></main>
    }

    // ===== Sub-renders (passed to StepMenuSelect) =====
    const renderMenuInfo = (menu) => (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>¥{menu.price.toLocaleString()} / 1名</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>約{menu.duration}分</span>
        </div>
    )

    const renderDurationSelector = (menu) => {
        if (form.menuId !== menu.id) return null
        if (!menu.durations || menu.durations.length <= 1) return null
        return (
            <div className="slide-up" style={{ marginTop: 'var(--sp-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>所要時間</p>
                <div className="duration-select">
                    {menu.durations.map(d => (
                        <button key={d}
                            className={`duration-chip ${(selectedDuration ?? menu.durations[0]) === d ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedDuration(d) }}>
                            {d}分
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    const renderGuestSelector = (menu) => {
        if (form.menuId !== menu.id) return null
        // maxPeople: カテゴリ > メニュー > settings のフォールバック
        const cat = menu.parentId ? menus.find(m => m.id === menu.parentId) : null
        const menuMax = cat?.maxPeople || menu.maxPeople || maxConcurrentGuests
        const guestChoices = Array.from({ length: menuMax }, (_, i) => i + 1)
        return (
            <div className="slide-up" style={{ marginTop: 'var(--sp-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>利用人数</p>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                    {guestChoices.map(n => (
                        <button key={n}
                            className={`btn ${form.guests === n ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: 1, padding: 'var(--sp-2) 0' }}
                            onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, guests: n })) }}>
                            {n}名
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{form.guests}名分の目安</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{formatPrice(menu.price * form.guests)}</span>
                </div>
            </div>
        )
    }

    return (
        <main className="page">
            <div className="container" style={{ maxWidth: 780 }}>
                <div className="hero-section">
                    <h1>ご予約</h1>
                    <p>心と体を癒す酵素風呂・よもぎ蒸しをお楽しみください</p>
                </div>

                <div className="stepper">
                    {STEPS.map((s, i) => (
                        <div key={s} className={`stepper-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
                            <div className="stepper-number">{i < step ? '✓' : i + 1}</div>
                            <span className="stepper-label">{s}</span>
                        </div>
                    ))}
                </div>

                <div className="slide-up" key={step}>

                    {step === 0 && (
                        <StepCustomerInfo form={form} setForm={setForm} errors={errors} setErrors={setErrors} />
                    )}

                    {step === 1 && (
                        <StepMenuSelect
                            menuGroups={menuGroups} form={form} selectedMenu={selectedMenu}
                            openCategoryId={openCategoryId} setOpenCategoryId={setOpenCategoryId}
                            selectMenu={selectMenu} menus={menus} isRepeater={isRepeater}
                            errors={errors} setForm={setForm} setSelectedDuration={setSelectedDuration}
                            selectedDuration={selectedDuration}
                            renderMenuInfo={renderMenuInfo} renderDurationSelector={renderDurationSelector}
                            renderGuestSelector={renderGuestSelector}
                        />
                    )}

                    {step === 2 && (
                        <StepOptions
                            filteredOptions={filteredOptions} form={form} setForm={setForm}
                            selectedMenu={selectedMenu} formatPrice={formatPrice}
                            totalPrice={totalPrice} hasMassageChair={hasMassageChair}
                            massageTime={massageTime} totalEstimatedTime={totalEstimatedTime}
                            toggleOption={toggleOption} selectedDuration={selectedDuration}
                            setStep={setStep}
                        />
                    )}

                    {step === 3 && (
                        <StepDateTime
                            form={form} setForm={setForm} pickedHour={pickedHour}
                            setPickedHour={setPickedHour} dayRanges={dayRanges}
                            hourOptions={hourOptions} minuteOptions={minuteOptions}
                            selectedSlotData={selectedSlotData} currentMonth={currentMonth}
                            setCurrentMonth={setCurrentMonth} availableDates={availableDates}
                            errors={errors} pickDate={pickDate} pickHour={pickHour}
                            pickMinute={pickMinute} setStep={setStep}
                        />
                    )}

                    {step === 4 && (
                        <StepConfirmation
                            form={form} setForm={setForm} selectedMenu={selectedMenu}
                            menus={menus} options={options} filteredOptions={filteredOptions}
                            formatPrice={formatPrice} totalPrice={totalPrice}
                            totalEstimatedTime={totalEstimatedTime}
                            selectedSlotData={selectedSlotData} hasMassageChair={hasMassageChair}
                            bookedIntervals={bookedIntervals} totalDuration={totalDuration}
                            reservationPreview={reservationPreview}
                        />
                    )}

                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-8)', paddingBottom: 'var(--sp-8)' }}>
                    {step > 0 ? (
                        <button className="btn btn-secondary" onClick={prevStep}>← 戻る</button>
                    ) : <div />}
                    {step < STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={nextStep} disabled={repeaterLoading}>
                            {repeaterLoading ? '確認中...' : '次へ →'}
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ minWidth: 200 }}>
                            {submitting ? '送信中...' : '予約を確定する'}
                        </button>
                    )}
                </div>
            </div>
        </main>
    )
}
