/**
 * 名簿管理（管理画面）
 * 顧客一覧・検索・ソート + 詳細モーダル（編集・予約履歴）
 * 重複検出・顧客統合（マージ）機能
 * 予約作成時に自動リンクされた顧客を管理。来店回数・メモの確認
 * 関連: api/customers.js, api/reservations.js
 */
import { useState, useEffect, useMemo } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getCustomers, updateCustomer, getCustomerReservations, getMenus, getStatusLabel, getStatusColor, formatPrice, findDuplicates, mergeCustomers } from '../lib/api'

// ── サマリーチップ ──────────────────────────────────────────────
function SummaryChip({ label, value, color, bg }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '12px 18px', borderRadius: 12,
            background: bg, minWidth: 90, flex: 1,
        }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{label}</span>
        </div>
    )
}

// ── 来店回数バッジ ──────────────────────────────────────────────
function VisitBadge({ count }) {
    const bg = count === 0 ? '#faf3e6' : count >= 5 ? '#e0f2e9' : '#eaf2f0'
    const color = count === 0 ? '#B89658' : count >= 5 ? '#2E7D32' : '#4E7A6E'
    const label = count === 0 ? '未来店' : `${count}回`
    return (
        <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: 99, background: bg, color, whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    )
}

// ── 顧客カード ──────────────────────────────────────────────────
function CustomerCard({ customer, onClick, isSelected }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
                background: isSelected ? 'var(--primary-soft)' : 'var(--bg-card)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary-light)' : 'var(--border)',
                borderRadius: 10, marginBottom: 6,
                transition: 'box-shadow 0.15s, border-color 0.15s',
                boxShadow: isSelected ? '0 4px 18px rgba(58,95,86,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 3px 12px rgba(58,95,86,0.08)' }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
        >
            {/* アバター */}
            <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
            }}>
                {(customer.lastName || '?')[0]}
            </div>

            {/* 情報 */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>
                        {customer.lastName} {customer.firstName}
                    </span>
                    {customer.lastNameKana && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {customer.lastNameKana} {customer.firstNameKana}
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {customer.phone || customer.email || '連絡先未登録'}
                </div>
            </div>

            {/* 来店バッジ + 最終来店日 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <VisitBadge count={customer.visitCount || 0} />
                {customer.lastVisitDate && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        最終: {customer.lastVisitDate}
                    </span>
                )}
            </div>
        </div>
    )
}

// ── 予約履歴アイテム ────────────────────────────────────────────
function ReservationHistoryItem({ res, menuName }) {
    const statusColor = getStatusColor(res.status)
    const statusLabel = getStatusLabel(res.status)
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: 'var(--bg-elevated)',
            borderRadius: 8, marginBottom: 4,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                    {res.date} {res.time}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                    {menuName || res.menuId} {res.guests > 1 ? `× ${res.guests}名` : ''}
                </div>
            </div>
            <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 99, background: statusColor + '18', color: statusColor,
            }}>
                {statusLabel}
            </span>
            {res.totalPrice > 0 && (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)' }}>
                    {formatPrice(res.totalPrice)}
                </span>
            )}
        </div>
    )
}

// ── フィールドラベル ────────────────────────────────────────────
function FieldLabel({ children }) {
    return (
        <label style={{
            fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
            display: 'block', marginBottom: 5,
        }}>
            {children}
        </label>
    )
}

// ── 顧客詳細モーダル ────────────────────────────────────────────
function CustomerDetailModal({ customer, menus, onClose, onSave }) {
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [reservations, setReservations] = useState([])
    const [loadingRes, setLoadingRes] = useState(true)

    useEffect(() => {
        setEditing(false)
        setForm({
            lastName: customer.lastName || '',
            firstName: customer.firstName || '',
            lastNameKana: customer.lastNameKana || '',
            firstNameKana: customer.firstNameKana || '',
            phone: customer.phone || '',
            email: customer.email || '',
            memo: customer.memo || '',
            visitCount: customer.visitCount || 0,
            phone2: customer.phone2 || '',
            email2: customer.email2 || '',
        })
        setLoadingRes(true)
        getCustomerReservations(customer.id).then(res => {
            setReservations(res)
            setLoadingRes(false)
        }).catch(() => setLoadingRes(false))
    }, [customer.id])

    const menuMap = useMemo(() => {
        const m = {}
        menus.forEach(menu => { m[menu.id] = menu.name })
        return m
    }, [menus])

    async function handleSave() {
        setSaving(true)
        const updates = { ...form }
        // visitCount を数値に変換
        updates.visitCount = parseInt(updates.visitCount, 10) || 0
        // 空の phone2/email2 は送信しない（既存データを消さないため）
        if (!updates.phone2) delete updates.phone2
        if (!updates.email2) delete updates.email2
        const result = await updateCustomer(customer.id, updates)
        setSaving(false)
        if (result.success) {
            setEditing(false)
            onSave({ ...customer, ...updates })
        }
    }

    const inputStyle = {
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid var(--border)', fontSize: '0.88rem',
        background: editing ? '#fff' : 'var(--bg-elevated)',
        color: 'var(--text)',
    }

    const hasSubContacts = (customer.phone2 || customer.email2 || (editing && (form.phone2 || form.email2)))

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
                zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                paddingTop: 40,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div style={{
                background: 'white', borderRadius: 16,
                width: '92%', maxWidth: 560, maxHeight: '85vh',
                overflow: 'auto', padding: 0,
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}>
                {/* ── ヘッダー ── */}
                <div style={{
                    padding: '20px 24px 16px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                    borderRadius: '16px 16px 0 0',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 14,
                }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', fontWeight: 700, flexShrink: 0,
                    }}>
                        {(customer.lastName || '?')[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            {customer.lastName} {customer.firstName}
                        </div>
                        {customer.lastNameKana && (
                            <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                                {customer.lastNameKana} {customer.firstNameKana}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{
                            fontSize: '1.4rem', fontWeight: 800, lineHeight: 1,
                        }}>
                            {customer.visitCount || 0}
                        </span>
                        <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>来店回数</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: 14, right: 16,
                            background: 'rgba(255,255,255,0.2)', border: 'none',
                            borderRadius: '50%', width: 30, height: 30,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#fff', fontSize: '1rem',
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* ── コンテンツ ── */}
                <div style={{ padding: '20px 24px 24px' }}>
                    {/* 編集トグル */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        {!editing ? (
                            <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 14px' }}
                                onClick={() => setEditing(true)}>
                                編集
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 14px' }}
                                    onClick={() => setEditing(false)}>
                                    キャンセル
                                </button>
                                <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '5px 14px' }}
                                    onClick={handleSave} disabled={saving}>
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 基本情報 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                            <FieldLabel>姓</FieldLabel>
                            <input style={inputStyle} value={form.lastName || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                        </div>
                        <div>
                            <FieldLabel>名</FieldLabel>
                            <input style={inputStyle} value={form.firstName || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                        </div>
                        <div>
                            <FieldLabel>セイ</FieldLabel>
                            <input style={inputStyle} value={form.lastNameKana || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, lastNameKana: e.target.value }))} />
                        </div>
                        <div>
                            <FieldLabel>メイ</FieldLabel>
                            <input style={inputStyle} value={form.firstNameKana || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, firstNameKana: e.target.value }))} />
                        </div>
                    </div>

                    {/* 連絡先 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: hasSubContacts ? 8 : 16 }}>
                        <div>
                            <FieldLabel>電話番号</FieldLabel>
                            <input style={inputStyle} value={form.phone || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div>
                            <FieldLabel>メール</FieldLabel>
                            <input style={inputStyle} value={form.email || ''} readOnly={!editing}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                    </div>

                    {/* サブ連絡先（phone2/email2） */}
                    {hasSubContacts && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <FieldLabel>電話番号（サブ）</FieldLabel>
                                <input style={inputStyle} value={form.phone2 || ''} readOnly={!editing}
                                    onChange={e => setForm(f => ({ ...f, phone2: e.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>メール（サブ）</FieldLabel>
                                <input style={inputStyle} value={form.email2 || ''} readOnly={!editing}
                                    onChange={e => setForm(f => ({ ...f, email2: e.target.value }))} />
                            </div>
                        </div>
                    )}

                    {/* 来店回数（編集可能） */}
                    {editing && (
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>来店回数</FieldLabel>
                            <input
                                type="number" min="0" step="1"
                                style={{ ...inputStyle, width: 100 }}
                                value={form.visitCount}
                                onChange={e => setForm(f => ({ ...f, visitCount: e.target.value }))}
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                        <FieldLabel>メモ</FieldLabel>
                        <textarea
                            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                            value={form.memo || ''}
                            readOnly={!editing}
                            onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                            placeholder={editing ? 'スタッフメモを入力...' : ''}
                        />
                    </div>

                    {/* 来店情報 */}
                    <div style={{
                        display: 'flex', gap: 12, marginBottom: 20,
                        padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10,
                    }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>最終来店</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                                {customer.lastVisitDate || '—'}
                            </div>
                        </div>
                        <div style={{ width: 1, background: 'var(--border)' }} />
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>登録日</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                                {customer.createdAt ? customer.createdAt.split('T')[0] : '—'}
                            </div>
                        </div>
                    </div>

                    {/* 予約履歴 */}
                    <div>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                            予約履歴
                        </h3>
                        {loadingRes ? (
                            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>読み込み中...</div>
                        ) : reservations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                予約履歴がありません
                            </div>
                        ) : (
                            reservations.map(r => (
                                <ReservationHistoryItem key={r.id} res={r} menuName={menuMap[r.menuId]} />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── マージダイアログ ─────────────────────────────────────────────
function MergeDialog({ group, onClose, onMerged }) {
    const [primaryId, setPrimaryId] = useState(() => {
        // デフォルト: visitCount が最大の顧客
        const sorted = [...group].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        return sorted[0]?.id || ''
    })
    const [keepSubContacts, setKeepSubContacts] = useState(true)
    const [merging, setMerging] = useState(false)
    const [error, setError] = useState('')

    const primary = group.find(c => c.id === primaryId)
    const secondaries = group.filter(c => c.id !== primaryId)

    // 統合後プレビュー
    const preview = useMemo(() => {
        if (!primary) return null
        const totalVisit = group.reduce((s, c) => s + (c.visitCount || 0), 0)
        const allDates = group.map(c => c.lastVisitDate || '').filter(Boolean)
        const latestVisit = allDates.length ? allDates.sort().pop() : ''
        const phone = primary.phone || secondaries.find(c => c.phone)?.phone || ''
        const email = primary.email || secondaries.find(c => (c.email || '').trim())?.email || ''
        return { totalVisit, latestVisit, phone, email }
    }, [primary, secondaries, group])

    async function handleMerge() {
        if (!primaryId || secondaries.length === 0) return
        setMerging(true)
        setError('')
        const result = await mergeCustomers(primaryId, secondaries.map(c => c.id), { keepSubContacts })
        setMerging(false)
        if (result.success) {
            onMerged()
        } else {
            setError(result.error || '統合に失敗しました')
        }
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div style={{
                background: 'white', borderRadius: 16,
                width: '92%', maxWidth: 500, maxHeight: '80vh',
                overflow: 'auto', padding: 24,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4, marginTop: 0 }}>
                    顧客の統合
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                    残す顧客を選択してください。他の顧客の予約履歴と来店回数が統合されます。
                </p>

                {/* 顧客選択 */}
                {group.map(c => (
                    <div
                        key={c.id}
                        onClick={() => setPrimaryId(c.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', marginBottom: 6,
                            borderRadius: 10, cursor: 'pointer',
                            border: '2px solid',
                            borderColor: c.id === primaryId ? 'var(--primary)' : 'var(--border)',
                            background: c.id === primaryId ? 'var(--primary-soft)' : 'var(--bg-card)',
                            transition: 'all 0.15s',
                        }}
                    >
                        <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: '2px solid',
                            borderColor: c.id === primaryId ? 'var(--primary)' : '#ccc',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            {c.id === primaryId && (
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>
                                {c.lastName} {c.firstName}
                                {c.id === primaryId && (
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px',
                                        borderRadius: 4, background: 'var(--primary)', color: '#fff', marginLeft: 6,
                                    }}>残す</span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                {c.phone || '—'} / {c.email || '—'}
                            </div>
                        </div>
                        <VisitBadge count={c.visitCount || 0} />
                    </div>
                ))}

                {/* サブ連絡先オプション */}
                {secondaries.some(c => c.phone || c.email) && (
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '0.82rem', color: 'var(--text-secondary)',
                        padding: '10px 0', cursor: 'pointer',
                    }}>
                        <input
                            type="checkbox"
                            checked={keepSubContacts}
                            onChange={e => setKeepSubContacts(e.target.checked)}
                            style={{ width: 16, height: 16 }}
                        />
                        統合される顧客の連絡先をサブとして保持
                    </label>
                )}

                {/* プレビュー */}
                {preview && (
                    <div style={{
                        padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10,
                        marginTop: 8, marginBottom: 16,
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                            統合後のプレビュー
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.82rem' }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>来店回数:</span> <strong>{preview.totalVisit}回</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>最終来店:</span> {preview.latestVisit || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>電話:</span> {preview.phone || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>メール:</span> {preview.email || '—'}</div>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ fontSize: '0.82rem', color: '#d32f2f', marginBottom: 12 }}>{error}</div>
                )}

                {/* ボタン */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                        onClick={onClose} disabled={merging}>
                        キャンセル
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                        onClick={handleMerge} disabled={merging}>
                        {merging ? '統合中...' : `統合する（${secondaries.length}件を統合）`}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── 重複グループ一覧パネル ────────────────────────────────────────
function DuplicatePanel({ groups, onMergeGroup, onClose }) {
    return (
        <div style={{
            marginBottom: 20, padding: '16px', background: '#FFF8E1',
            borderRadius: 12, border: '1px solid #FFE082',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#E65100', margin: 0 }}>
                    重複の可能性がある顧客: {groups.length}グループ
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.82rem', color: 'var(--text-muted)', padding: '4px 8px',
                    }}
                >
                    閉じる
                </button>
            </div>
            {groups.map((group, i) => (
                <div key={i} style={{
                    padding: '10px 12px', background: 'white',
                    borderRadius: 8, marginBottom: 6, border: '1px solid #FFE082',
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        {group.map(c => (
                            <span key={c.id} style={{
                                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)',
                                padding: '3px 8px', background: 'var(--bg-elevated)', borderRadius: 6,
                            }}>
                                {c.lastName} {c.firstName}
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                                    ({c.phone || c.email || 'ID:' + c.id.slice(0, 6)})
                                </span>
                            </span>
                        ))}
                        <button
                            className="btn btn-primary"
                            style={{ fontSize: '0.72rem', padding: '4px 10px', marginLeft: 'auto' }}
                            onClick={() => onMergeGroup(group)}
                        >
                            統合
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── ソートボタン ─────────────────────────────────────────────────
function SortButton({ label, field, sortField, sortDir, onSort }) {
    const isActive = sortField === field
    return (
        <button
            onClick={() => onSort(field)}
            style={{
                padding: '5px 12px', borderRadius: 99,
                border: '1px solid',
                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
            }}
        >
            {label}
            {isActive && <span style={{ fontSize: '0.65rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
        </button>
    )
}

// ── メインページ ────────────────────────────────────────────────
export default function CustomerManagement() {
    const [customers, setCustomers] = useState([])
    const [menus, setMenus] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortField, setSortField] = useState('lastUpdated')
    const [sortDir, setSortDir] = useState('desc')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    // 重複検出
    const [dupGroups, setDupGroups] = useState(null) // null=未チェック, []=チェック済み0件
    const [mergeTarget, setMergeTarget] = useState(null) // マージダイアログ用のグループ
    const [checking, setChecking] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    function loadData() {
        setLoading(true)
        Promise.all([getCustomers(), getMenus()]).then(([c, m]) => {
            setCustomers(c)
            setMenus(m)
            setLoading(false)
        }).catch(() => setLoading(false))
    }

    function handleSort(field) {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'name' || field === 'kana' ? 'asc' : 'desc')
        }
    }

    // 重複チェック
    async function handleDuplicateCheck() {
        setChecking(true)
        const groups = findDuplicates(customers)
        setDupGroups(groups)
        setChecking(false)
    }

    // マージ完了後
    async function handleMerged() {
        setMergeTarget(null)
        setDupGroups(null)
        // データ再取得
        const c = await getCustomers()
        setCustomers(c)
        // 再チェック
        const groups = findDuplicates(c)
        setDupGroups(groups)
    }

    const filtered = useMemo(() => {
        let list = [...customers]
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter(c =>
                ((c.lastName || '') + (c.firstName || '')).includes(q) ||
                ((c.lastNameKana || '') + (c.firstNameKana || '')).includes(q) ||
                (c.phoneNorm || '').includes(q.replace(/[^0-9]/g, '')) ||
                (c.email || '').toLowerCase().includes(q)
            )
        }
        list.sort((a, b) => {
            let av, bv
            switch (sortField) {
                case 'name': av = (a.lastName || '') + (a.firstName || ''); bv = (b.lastName || '') + (b.firstName || ''); break
                case 'kana': av = (a.lastNameKana || '') + (a.firstNameKana || ''); bv = (b.lastNameKana || '') + (b.firstNameKana || ''); break
                case 'visitCount': av = a.visitCount || 0; bv = b.visitCount || 0; break
                case 'lastVisitDate': av = a.lastVisitDate || ''; bv = b.lastVisitDate || ''; break
                default: av = a.lastUpdated || ''; bv = b.lastUpdated || ''
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1
            if (av > bv) return sortDir === 'asc' ? 1 : -1
            return 0
        })
        return list
    }, [customers, searchQuery, sortField, sortDir])

    // サマリー計算
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const totalCount = customers.length
    const repeaterCount = customers.filter(c => (c.visitCount || 0) >= 2).length
    const newThisMonth = customers.filter(c => c.createdAt && c.createdAt.startsWith(thisMonth)).length
    const noVisitCount = customers.filter(c => (c.visitCount || 0) === 0).length

    function handleCustomerSaved(updated) {
        setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
        setSelectedCustomer(updated)
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content">
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                        <div className="loading-spinner" />
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                            名簿管理
                        </h1>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            お客様情報の管理・来店履歴の確認
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        style={{
                            fontSize: '0.78rem', padding: '6px 14px',
                            display: 'flex', alignItems: 'center', gap: 6,
                            position: 'relative',
                        }}
                        onClick={handleDuplicateCheck}
                        disabled={checking}
                    >
                        {checking ? '検出中...' : '重複チェック'}
                        {dupGroups && dupGroups.length > 0 && (
                            <span style={{
                                position: 'absolute', top: -6, right: -6,
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#E65100', color: '#fff',
                                fontSize: '0.65rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {dupGroups.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* サマリーチップ */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <SummaryChip label="総顧客数" value={totalCount} color="#3A5F56" bg="#e8f4f1" />
                    <SummaryChip label="リピーター" value={repeaterCount} color="#2E7D32" bg="#e0f2e9" />
                    <SummaryChip label="今月の新規" value={newThisMonth} color="#4E7A6E" bg="#eaf2f0" />
                    <SummaryChip label="未来店" value={noVisitCount} color="#B89658" bg="#faf3e6" />
                </div>

                {/* 重複グループ一覧 */}
                {dupGroups && dupGroups.length > 0 && (
                    <DuplicatePanel
                        groups={dupGroups}
                        onMergeGroup={group => setMergeTarget(group)}
                        onClose={() => setDupGroups(null)}
                    />
                )}
                {dupGroups && dupGroups.length === 0 && (
                    <div style={{
                        marginBottom: 20, padding: '12px 16px', background: '#E8F5E9',
                        borderRadius: 10, fontSize: '0.82rem', color: '#2E7D32', fontWeight: 600,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span>重複なし — すべての顧客レコードはユニークです</span>
                        <button onClick={() => setDupGroups(null)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: '0.78rem',
                        }}>閉じる</button>
                    </div>
                )}

                {/* 検索バー */}
                <div style={{ marginBottom: 14 }}>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="名前・電話番号・メールで検索..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px', fontSize: '0.88rem',
                            borderRadius: 10, border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                        }}
                    />
                </div>

                {/* ソートボタン */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    <SortButton label="名前" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label="フリガナ" field="kana" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label="来店回数" field="visitCount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label="最終来店" field="lastVisitDate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label="更新日" field="lastUpdated" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </div>

                {/* 件数 */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                    {filtered.length} 件{searchQuery && ` (${customers.length} 件中)`}
                </div>

                {/* 顧客一覧 */}
                {filtered.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: 40, color: 'var(--text-muted)',
                        fontSize: '0.88rem', background: 'var(--bg-card)', borderRadius: 12,
                    }}>
                        {searchQuery ? '検索結果がありません' : '顧客データがありません'}
                    </div>
                ) : (
                    filtered.map(c => (
                        <CustomerCard
                            key={c.id}
                            customer={c}
                            isSelected={selectedCustomer?.id === c.id}
                            onClick={() => setSelectedCustomer(c)}
                        />
                    ))
                )}

                {/* 詳細モーダル */}
                {selectedCustomer && (
                    <CustomerDetailModal
                        customer={selectedCustomer}
                        menus={menus}
                        onClose={() => setSelectedCustomer(null)}
                        onSave={handleCustomerSaved}
                    />
                )}

                {/* マージダイアログ */}
                {mergeTarget && (
                    <MergeDialog
                        group={mergeTarget}
                        onClose={() => setMergeTarget(null)}
                        onMerged={handleMerged}
                    />
                )}
            </main>
        </div>
    )
}
