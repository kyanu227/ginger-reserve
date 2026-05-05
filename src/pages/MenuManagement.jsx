/**
 * メニュー管理（管理画面）
 * カテゴリ・子メニュー・オプションの CRUD。タブ切替でメニュー/オプションを管理
 * カテゴリの maxPeople は子メニュー全体で共有される物理枠の最大人数
 * 関連: api/menus.js, CLAUDE.md セクション6（入れ子構造と空き判定）
 */
import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getMenus, getOptions, getResources, updateMenus, updateOptionsData, updateResourcesData } from '../lib/api'
import { RESOURCE_IDS, RESOURCE_PHASES } from '../domain/reservation'

// ── ユーティリティ ──────────────────────────────────────────────────────
function parseDurations(str) {
    return str.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0)
}

function visitBadge(minVisits, visibility) {
    const v = minVisits !== undefined ? minVisits
        : visibility === 'firstTime' ? -1 : visibility === 'repeater' ? 1 : 0
    if (v === -1) return { badge: '初回のみ', color: '#B89658', bg: '#faf3e6' }
    if (v === 0) return { badge: '全員', color: '#3A5F56', bg: '#e8f4f1' }
    return { badge: `リピ ${v}+`, color: '#4E7A6E', bg: '#eaf2f0' }
}

function defaultMenuResourceRequirements(parentId, durationMinutes = 20) {
    const resourceId = parentId?.includes('yomogi') ? RESOURCE_IDS.YOMOGI_ROOM : RESOURCE_IDS.ENZYME_BATH
    return [{ resourceId, phase: RESOURCE_PHASES.MAIN, durationMinutes, units: 'guests' }]
}

// ── フィールドラベル ─────────────────────────────────────────────────────
function FieldLabel({ children }) {
    return (
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
            {children}
        </label>
    )
}

// ── MenuCard ────────────────────────────────────────────────────────────
function MenuCard({ menu, onUpdate, onRemove, isChild, autoOpen }) {
    const [open, setOpen] = useState(!!autoOpen)
    const badge = visitBadge(menu.minVisits, menu.visibility)
    const dursStr = (menu.durations || [menu.duration || 20]).join(', ')

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: isChild ? '3px solid var(--primary-light,#5C8C7E)' : '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 8,
            opacity: menu.active ? 1 : 0.55,
            transition: 'box-shadow 0.15s, opacity 0.15s',
            boxShadow: open ? '0 4px 18px rgba(58,95,86,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
        }}>
            {/* ── ヘッダー行 ─────────────────── */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', userSelect: 'none', background: open ? 'var(--bg-elevated)' : 'transparent' }}
                onClick={() => setOpen(o => !o)}
            >
                <span style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0
                }}>{menu.icon ?? ''}</span>

                <span style={{ fontWeight: 600, flex: 1, fontSize: '0.92rem', color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {menu.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>名前未設定</span>}
                </span>

                {!open && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                            ¥{Number(menu.price || 0).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 99, background: badge.bg, color: badge.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {badge.badge}
                        </span>
                    </div>
                )}

                <label
                    style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    <input type="checkbox" checked={!!menu.active} onChange={e => onUpdate('active', e.target.checked)} />
                    有効
                </label>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
            </div>

            {/* ── 編集フォーム ────────────────── */}
            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 14px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 名前・アイコン */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px', gap: 10 }}>
                        <div>
                            <FieldLabel>メニュー名</FieldLabel>
                            <input className="form-input" value={menu.name} onChange={e => onUpdate('name', e.target.value)} placeholder="例：セットメニュー" />
                        </div>
                        <div>
                            <FieldLabel>アイコン</FieldLabel>
                            <input className="form-input" value={menu.icon || ''} onChange={e => onUpdate('icon', e.target.value)} style={{ textAlign: 'center', fontSize: '1.1rem' }} />
                        </div>
                    </div>

                    {/* 説明文 */}
                    <div>
                        <FieldLabel>説明文</FieldLabel>
                        <textarea className="form-input" rows={2} value={menu.description || ''} onChange={e => onUpdate('description', e.target.value)} placeholder="このメニューの説明..." style={{ resize: 'vertical' }} />
                    </div>

                    {/* 料金・時間・人数 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        <div>
                            <FieldLabel>料金（円）</FieldLabel>
                            <input className="form-input" type="number" min="0" value={menu.price || 0} onChange={e => onUpdate('price', Number(e.target.value))} />
                        </div>
                        <div>
                            <FieldLabel>所要時間（分）</FieldLabel>
                            <input className="form-input" value={dursStr}
                                onChange={e => {
                                    const arr = parseDurations(e.target.value)
                                    onUpdate('durations', arr)
                                    if (arr.length > 0) onUpdate('duration', arr[0])
                                    if (arr.length > 0 && menu.resourceRequirements?.length) {
                                        onUpdate('resourceRequirements', menu.resourceRequirements.map(req => req.phase === RESOURCE_PHASES.MAIN ? { ...req, durationMinutes: arr[0] } : req))
                                    }
                                }}
                                placeholder="20 または 20,40" />
                        </div>
                        <div>
                            <FieldLabel>同時人数上限</FieldLabel>
                            <input className="form-input" type="number" min="1" value={menu.maxPeople ?? 2} onChange={e => onUpdate('maxPeople', Number(e.target.value))} />
                        </div>
                    </div>

                    {/* 表示条件・削除 */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <FieldLabel>表示条件（最低来店回数）</FieldLabel>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input className="form-input" type="number" min="-1"
                                    value={menu.minVisits !== undefined ? menu.minVisits : (menu.visibility === 'firstTime' ? -1 : menu.visibility === 'repeater' ? 1 : 0)}
                                    onChange={e => {
                                        const v = Number(e.target.value)
                                        onUpdate('minVisits', v)
                                        onUpdate('visibility', v === -1 ? 'firstTime' : v >= 1 ? 'repeater' : 'all')
                                    }}
                                    style={{ width: 70 }}
                                />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                    0=全員 / -1=初回のみ / N=N回以上
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onRemove}
                            style={{ background: '#fff0ef', border: '1px solid #f5c6c3', color: '#c0392b', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
                            🗑 削除
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── ResourceCard ────────────────────────────────────────────────────────
function ResourceCard({ resource, onUpdate, onRemove, autoOpen }) {
    const [open, setOpen] = useState(!!autoOpen)

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 8,
            opacity: resource.active ? 1 : 0.55,
            boxShadow: open ? '0 4px 18px rgba(58,95,86,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', userSelect: 'none', background: open ? 'var(--bg-elevated)' : 'transparent' }}
                onClick={() => setOpen(o => !o)}>
                <span style={{ fontWeight: 700, flex: 1, fontSize: '0.92rem', color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {resource.name || resource.id}
                </span>
                {!open && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
                        capacity {resource.capacity || 1}
                    </span>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={!!resource.active} onChange={e => onUpdate('active', e.target.checked)} />
                    有効
                </label>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
            </div>

            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 14px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10 }}>
                        <div>
                            <FieldLabel>resourceId</FieldLabel>
                            <input className="form-input" value={resource.id} onChange={e => onUpdate('id', e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>表示名</FieldLabel>
                            <input className="form-input" value={resource.name || ''} onChange={e => onUpdate('name', e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>同時利用数</FieldLabel>
                            <input className="form-input" type="number" min="1" value={resource.capacity || 1} onChange={e => onUpdate('capacity', Number(e.target.value))} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>
                            メニュー・オプションの resourceRequirements がこのIDを参照します。
                        </p>
                        <button onClick={onRemove} style={{ background: '#fff0ef', border: '1px solid #f5c6c3', color: '#c0392b', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                            削除
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── CategorySection ─────────────────────────────────────────────────────
function CategorySection({ category, children, newChildIds, onUpdateCat, onRemoveCat, onAddChild, onUpdateChild, onRemoveChild }) {
    const [open, setOpen] = useState(false)
    const childCount = children.length
    const activeCount = children.filter(c => c.active).length

    // カテゴリ編集フィールド用の共通ラベルスタイル
    const catLabel = { fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }
    const catInput = { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8 }

    return (
        <div style={{ marginBottom: 16 }}>
            {/* ── カテゴリヘッダーカード ────── */}
            <div style={{
                background: open
                    ? 'linear-gradient(135deg, #3A5F56 0%, #2a4840 100%)'
                    : 'linear-gradient(135deg, #4a6f66 0%, #3A5F56 100%)',
                borderRadius: open ? '12px 12px 0 0' : 12,
                boxShadow: open ? '0 4px 20px rgba(42,72,64,0.22)' : '0 2px 8px rgba(42,72,64,0.15)',
                overflow: 'hidden',
                transition: 'border-radius 0.2s, box-shadow 0.2s',
            }}>
                {/* タイトル行（クリックで全体を開閉） */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: open ? '13px 16px' : '10px 16px', cursor: 'pointer', userSelect: 'none', transition: 'padding 0.15s' }}
                    onClick={() => setOpen(o => !o)}>
                    <span style={{
                        width: open ? 34 : 28, height: open ? 34 : 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: open ? '1.1rem' : '0.95rem', flexShrink: 0,
                        transition: 'all 0.15s',
                    }}>{category.icon ?? ''}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: open ? '0.97rem' : '0.88rem', color: 'white', transition: 'font-size 0.15s' }}>
                                {category.name || <span style={{ opacity: 0.55, fontStyle: 'italic' }}>カテゴリ名未設定</span>}
                            </span>
                            {!open && (
                                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                                    {childCount}件（有効{activeCount}）・最大{category.maxPeople ?? 2}人
                                </span>
                            )}
                        </div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
                </div>

                {/* 編集フィールド（展開時のみ） */}
                {open && (
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* 1行目: 名前・アイコン・最大人数 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', gap: 8, paddingTop: 10 }}>
                        <div>
                            <label style={catLabel}>カテゴリ名</label>
                            <input className="form-input" value={category.name || ''} onChange={e => onUpdateCat('name', e.target.value)}
                                placeholder="例：酵素風呂" style={catInput} onClick={e => e.stopPropagation()} />
                        </div>
                        <div>
                            <label style={catLabel}>アイコン</label>
                            <input className="form-input" value={category.icon ?? ''} onChange={e => onUpdateCat('icon', e.target.value)}
                                style={{ ...catInput, textAlign: 'center', fontSize: '1.1rem' }} onClick={e => e.stopPropagation()} />
                        </div>
                        <div>
                            <label style={catLabel}>最大人数</label>
                            <input className="form-input" type="number" min="1" value={category.maxPeople ?? 2}
                                onChange={e => onUpdateCat('maxPeople', Number(e.target.value))}
                                style={catInput} onClick={e => e.stopPropagation()} />
                        </div>
                    </div>
                    {/* 2行目: 説明・削除 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={catLabel}>説明（任意）</label>
                            <input className="form-input" value={category.description || ''} onChange={e => onUpdateCat('description', e.target.value)}
                                placeholder="このカテゴリの概要..." style={catInput} onClick={e => e.stopPropagation()} />
                        </div>
                        <button onClick={e => { e.stopPropagation(); onRemoveCat() }}
                            style={{ background: 'rgba(255,100,80,0.15)', border: '1px solid rgba(255,100,80,0.3)', color: 'rgba(255,180,170,0.9)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            🗑 削除
                        </button>
                    </div>
                </div>
                )}
            </div>

            {/* ── 子メニューリスト（展開時のみ） ──────────── */}
            {open && (
                <div style={{ paddingLeft: 18, paddingTop: 6, paddingBottom: 4, borderLeft: '2px solid var(--primary-light,#5C8C7E)', marginLeft: 10, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderRadius: '0 0 0 12px', background: 'var(--bg-card)' }}>
                    {childCount === 0 && (
                        <div style={{ padding: '14px 0 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            まだメニューがありません
                        </div>
                    )}
                    {children.map(menu => (
                        <MenuCard
                            key={menu.id}
                            menu={menu}
                            isChild
                            autoOpen={newChildIds?.has(menu.id)}
                            onUpdate={(field, val) => onUpdateChild(menu.id, field, val)}
                            onRemove={() => onRemoveChild(menu.id)}
                        />
                    ))}
                    <button
                        onClick={onAddChild}
                        style={{
                            width: 'calc(100% - 8px)', padding: '8px 0', marginTop: 2, marginBottom: 6,
                            background: 'transparent', border: '1.5px dashed var(--primary-light,#5C8C7E)',
                            borderRadius: 9, color: 'var(--primary)',
                            cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'background 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--primary-soft)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                        ＋ メニューを追加
                    </button>
                </div>
            )}
        </div>
    )
}

// ── OptionCard ──────────────────────────────────────────────────────────
function OptionCard({ opt, onUpdate, onRemove, autoOpen }) {
    const [open, setOpen] = useState(!!autoOpen)

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid #B89658',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 8,
            opacity: opt.active ? 1 : 0.55,
            boxShadow: open ? '0 4px 18px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.05)',
            transition: 'box-shadow 0.15s, opacity 0.15s',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', userSelect: 'none', background: open ? 'var(--bg-elevated)' : 'transparent' }}
                onClick={() => setOpen(o => !o)}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: '#faf3e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    {opt.icon ?? ''}
                </span>
                <span style={{ fontWeight: 600, flex: 1, fontSize: '0.92rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {opt.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>名前未設定</span>}
                </span>
                {!open && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B89658', background: '#faf3e6', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
                        {opt.price === 0 ? '無料' : `¥${Number(opt.price || 0).toLocaleString()}`}
                    </span>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={!!opt.active} onChange={e => onUpdate('active', e.target.checked)} />
                    有効
                </label>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
            </div>

            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 14px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 120px', gap: 10 }}>
                        <div>
                            <FieldLabel>オプション名</FieldLabel>
                            <input className="form-input" value={opt.name || ''} onChange={e => onUpdate('name', e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>アイコン</FieldLabel>
                            <input className="form-input" value={opt.icon || ''} onChange={e => onUpdate('icon', e.target.value)} style={{ textAlign: 'center', fontSize: '1.1rem' }} />
                        </div>
                        <div>
                            <FieldLabel>料金（円）</FieldLabel>
                            <input className="form-input" type="number" min="0" value={opt.price || 0} onChange={e => onUpdate('price', Number(e.target.value))} />
                        </div>
                    </div>
                    <div>
                        <FieldLabel>説明</FieldLabel>
                        <input className="form-input" value={opt.description || ''} onChange={e => onUpdate('description', e.target.value)} placeholder="オプションの説明..." />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={!!opt.isTimedResource} onChange={e => onUpdate('isTimedResource', e.target.checked)} />
                        <div>
                            <div style={{ color: 'var(--text)' }}>時間枠を占有するリソース</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: 1 }}>マッサージチェア等、枠が有限なオプション</div>
                        </div>
                    </label>

                    {opt.isTimedResource && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div>
                                <FieldLabel>同時利用台数</FieldLabel>
                                <input className="form-input" type="number" min="1" value={opt.units ?? 1} onChange={e => onUpdate('units', Number(e.target.value))} />
                            </div>
                            <div>
                                <FieldLabel>時間選択肢（分・カンマ区切り）</FieldLabel>
                                <input className="form-input" value={(opt.durations || []).join(', ')} onChange={e => onUpdate('durations', parseDurations(e.target.value))} placeholder="10, 20, 30" />
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: 'right' }}>
                        <button onClick={onRemove} style={{ background: '#fff0ef', border: '1px solid #f5c6c3', color: '#c0392b', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                            🗑 削除
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── メインコンポーネント ─────────────────────────────────────────────────
export default function MenuManagement() {
    const [menus, setMenus] = useState([])
    const [options, setOptions] = useState([])
    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [tab, setTab] = useState('menus')
    const [newMenuIds, setNewMenuIds] = useState(new Set())
    const [newOptIds, setNewOptIds] = useState(new Set())
    const [newResourceIds, setNewResourceIds] = useState(new Set())

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [m, o, r] = await Promise.all([getMenus(), getOptions(), getResources()])
            setMenus(m)
            setOptions(o)
            setResources(r)
            setLoading(false)
        }
        load()
    }, [])

    // ── Menu operations ─────────────────────────────────────────────────
    function updateMenuField(id, field, value) {
        setMenus(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
        setSaved(false)
    }

    function removeMenuById(id) {
        const menu = menus.find(m => m.id === id)
        const childCount = menu?.isCategory ? menus.filter(m => m.parentId === id).length : 0
        const msg = childCount > 0
            ? `「${menu.name || 'このカテゴリ'}」とその${childCount}件のメニューを削除しますか？`
            : `「${menu?.name || 'このメニュー'}」を削除しますか？`
        if (!confirm(msg)) return
        setMenus(prev => prev.filter(m => m.id !== id && m.parentId !== id))
        setSaved(false)
    }

    function addCategory() {
        const id = 'cat-' + Date.now()
        setMenus(prev => [...prev, {
            id, name: '', icon: '🌿', description: '', isCategory: true,
            parentId: null, active: true, maxPeople: 2, order: prev.length
        }])
        setNewMenuIds(prev => new Set([...prev, id]))
        setSaved(false)
    }

    function addChildMenu(parentId) {
        const id = 'menu-' + Date.now()
        setMenus(prev => [...prev, {
            id, name: '', icon: '✨', parentId, isCategory: false, category: 'main',
            price: 0, duration: 20, durations: [20], maxPeople: 2, minVisits: 0,
            description: '', active: true, visibility: 'all',
            resourceRequirements: defaultMenuResourceRequirements(parentId, 20),
            order: prev.filter(m => m.parentId === parentId).length
        }])
        setNewMenuIds(prev => new Set([...prev, id]))
        setSaved(false)
    }

    function addStandaloneMenu() {
        const id = 'menu-' + Date.now()
        setMenus(prev => [...prev, {
            id, name: '', icon: '🌿', parentId: null, isCategory: false, category: 'main',
            price: 0, duration: 20, durations: [20], maxPeople: 2, minVisits: 0,
            description: '', active: true, visibility: 'all',
            resourceRequirements: defaultMenuResourceRequirements(null, 20),
            order: prev.length
        }])
        setNewMenuIds(prev => new Set([...prev, id]))
        setSaved(false)
    }

    // ── Option operations ────────────────────────────────────────────────
    function updateOptionField(id, field, value) {
        setOptions(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
        setSaved(false)
    }

    function removeOptionById(id) {
        const opt = options.find(o => o.id === id)
        if (!confirm(`「${opt?.name || 'このオプション'}」を削除しますか？`)) return
        setOptions(prev => prev.filter(o => o.id !== id))
        setSaved(false)
    }

    function addOption() {
        const id = 'opt-' + Date.now()
        setOptions(prev => [...prev, {
            id, name: '', price: 0, description: '', icon: '✨',
            active: true, units: 1, durations: [], isTimedResource: false
        }])
        setNewOptIds(prev => new Set([...prev, id]))
        setSaved(false)
    }

    // ── Resource operations ─────────────────────────────────────────────
    function updateResourceField(id, field, value) {
        setResources(prev => prev.map(resource => resource.id === id ? { ...resource, [field]: value } : resource))
        setSaved(false)
    }

    function removeResourceById(id) {
        const resource = resources.find(r => r.id === id)
        if (!confirm(`「${resource?.name || resource?.id || 'このリソース'}」を削除しますか？`)) return
        setResources(prev => prev.filter(r => r.id !== id))
        setSaved(false)
    }

    function addResource() {
        const id = 'resource-' + Date.now()
        setResources(prev => [...prev, { id, name: '', capacity: 1, active: true, order: prev.length }])
        setNewResourceIds(prev => new Set([...prev, id]))
        setSaved(false)
    }

    // ── Save ─────────────────────────────────────────────────────────────
    async function handleSave() {
        setSaving(true)
        try {
            if (tab === 'menus') {
                await updateMenus(menus.map((m, i) => ({ ...m, order: i })))
            } else if (tab === 'options') {
                await updateOptionsData(options.map((o, i) => ({ ...o, order: i })))
            } else {
                await updateResourcesData(resources.map((r, i) => ({ ...r, order: i })))
            }
            setNewMenuIds(new Set())
            setNewOptIds(new Set())
            setNewResourceIds(new Set())
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch {
            alert('保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    // ── Derived ──────────────────────────────────────────────────────────
    const categories = menus.filter(m => m.isCategory)
    const standaloneMenus = menus.filter(m => !m.isCategory && !m.parentId)
    const getChildren = catId => menus.filter(m => m.parentId === catId && !m.isCategory)
    const bookableCount = menus.filter(m => !m.isCategory).length
    const activeMenuCount = menus.filter(m => !m.isCategory && m.active).length
    const activeResourceCount = resources.filter(r => r.active).length

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content"><div className="loading-spinner" /></main>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content" style={{ paddingBottom: 80 }}>

                {/* ── ページヘッダー ──────────────────────────────── */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.3rem' }}>🍽</span> メニュー管理
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>コース・カテゴリ・オプションを編集します</p>
                </div>

                {/* ── サマリーチップス ────────────────────────────── */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                    {[
                        { label: 'カテゴリ', value: categories.length, color: '#3A5F56', bg: '#e8f4f1' },
                        { label: '総メニュー', value: bookableCount, color: '#4E7A6E', bg: '#eaf2f0' },
                        { label: '有効メニュー', value: activeMenuCount, color: '#2E7D32', bg: '#e8f5e9' },
                        { label: 'オプション', value: options.filter(o => o.active).length, color: '#B89658', bg: '#faf3e6' },
                        { label: 'リソース', value: activeResourceCount, color: '#1565C0', bg: '#eaf2ff' },
                    ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: bg, borderRadius: 99, border: `1px solid ${color}30` }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</span>
                            <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* ── タブ ────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
                    {[
                        { key: 'menus', label: `コースメニュー`, count: bookableCount },
                        { key: 'options', label: `オプション`, count: options.length },
                        { key: 'resources', label: `リソース`, count: resources.length },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                padding: '10px 20px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '0.9rem', fontWeight: tab === t.key ? 700 : 500,
                                color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottom: tab === t.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                                marginBottom: -2, transition: 'all 0.15s',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            {t.label}
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                                background: tab === t.key ? 'var(--primary-soft)' : 'var(--bg-elevated)',
                                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                            }}>{t.count}</span>
                        </button>
                    ))}
                </div>

                {/* ── メニュータブ ─────────────────────────────────── */}
                {tab === 'menus' && (
                    <div>
                        {/* カテゴリ＋子メニュー */}
                        {categories.length === 0 && standaloneMenus.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🌿</div>
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>メニューがありません</div>
                                <div style={{ fontSize: '0.82rem' }}>下のボタンからカテゴリまたは単体メニューを追加してください</div>
                            </div>
                        )}

                        {categories.map(cat => (
                            <CategorySection
                                key={cat.id}
                                category={cat}
                                children={getChildren(cat.id)}
                                newChildIds={newMenuIds}
                                onUpdateCat={(field, val) => updateMenuField(cat.id, field, val)}
                                onRemoveCat={() => removeMenuById(cat.id)}
                                onAddChild={() => addChildMenu(cat.id)}
                                onUpdateChild={(id, field, val) => updateMenuField(id, field, val)}
                                onRemoveChild={id => removeMenuById(id)}
                            />
                        ))}

                        {/* スタンドアロンメニュー */}
                        {standaloneMenus.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                {categories.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 8 }}>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>カテゴリなし</span>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                    </div>
                                )}
                                {standaloneMenus.map(menu => (
                                    <MenuCard key={menu.id} menu={menu} isChild={false}
                                        autoOpen={newMenuIds.has(menu.id)}
                                        onUpdate={(field, val) => updateMenuField(menu.id, field, val)}
                                        onRemove={() => removeMenuById(menu.id)} />
                                ))}
                            </div>
                        )}

                        {/* 追加ボタン */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                            <button onClick={addCategory} style={{
                                padding: '13px 10px', background: 'linear-gradient(135deg, var(--primary-soft) 0%, #d4ede7 100%)',
                                border: '1.5px dashed var(--primary)',
                                borderRadius: 10, color: 'var(--primary)',
                                cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                transition: 'transform 0.12s, box-shadow 0.12s',
                            }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(58,95,86,0.18)' }}
                                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                                📂 カテゴリを追加
                            </button>
                            <button onClick={addStandaloneMenu} style={{
                                padding: '13px 10px', background: 'var(--bg-elevated)',
                                border: '1.5px dashed var(--border)',
                                borderRadius: 10, color: 'var(--text-secondary)',
                                cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                transition: 'transform 0.12s, box-shadow 0.12s',
                            }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                                ＋ 単体メニューを追加
                            </button>
                        </div>
                    </div>
                )}

                {/* ── オプションタブ ────────────────────────────── */}
                {tab === 'options' && (
                    <div>
                        {options.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✨</div>
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>オプションがありません</div>
                                <div style={{ fontSize: '0.82rem' }}>下のボタンから追加してください</div>
                            </div>
                        )}
                        {options.map(opt => (
                            <OptionCard key={opt.id} opt={opt}
                                autoOpen={newOptIds.has(opt.id)}
                                onUpdate={(field, val) => updateOptionField(opt.id, field, val)}
                                onRemove={() => removeOptionById(opt.id)} />
                        ))}
                        <button onClick={addOption} style={{
                            width: '100%', padding: '13px 0', marginTop: 8,
                            background: '#faf3e6', border: '1.5px dashed #B89658',
                            borderRadius: 10, color: '#B89658',
                            cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            transition: 'transform 0.12s',
                        }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                            ＋ オプションを追加
                        </button>
                    </div>
                )}

                {/* ── リソースタブ ────────────────────────────── */}
                {tab === 'resources' && (
                    <div>
                        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                            設備リソースを管理します。予約可否は menuId ではなく、menu / option の resourceRequirements が消費する resourceId と capacity で判定します。
                        </div>
                        {resources.map(resource => (
                            <ResourceCard key={resource.id} resource={resource}
                                autoOpen={newResourceIds.has(resource.id)}
                                onUpdate={(field, val) => updateResourceField(resource.id, field, val)}
                                onRemove={() => removeResourceById(resource.id)} />
                        ))}
                        <button onClick={addResource} style={{
                            width: '100%', padding: '13px 0', marginTop: 8,
                            background: 'var(--primary-soft)', border: '1.5px dashed var(--primary)',
                            borderRadius: 10, color: 'var(--primary)',
                            cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        }}>
                            ＋ リソースを追加
                        </button>
                    </div>
                )}

                {/* ── スティッキー保存バー ──────────────────────── */}
                <div style={{
                    position: 'fixed', bottom: 0, right: 0,
                    width: 'calc(100% - 240px)', // AdminSidebarの幅を引く
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(10px)',
                    borderTop: '1px solid var(--border)',
                    padding: '12px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14,
                    zIndex: 100,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.07)',
                }}>
                    {saved && (
                        <span style={{ fontSize: '0.82rem', color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            ✓ 保存しました
                        </span>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ minWidth: 120, fontWeight: 700 }}>
                        {saving ? '保存中...' : '💾 保存する'}
                    </button>
                </div>

            </main>
        </div>
    )
}
