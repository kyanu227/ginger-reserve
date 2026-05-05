/**
 * システム設定（管理画面）
 * タブ1: スタッフ管理（admin のみ） タブ2: 外部連携（GAS/カレンダー/LINE）
 * 関連: api/staff.js, api/settings.js, api/gas.js
 */
import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { useRole } from '../lib/RoleContext'
import { getSystemSettings, updateSystemSettings, getStaff, addStaff, updateStaff, saveLineToken, getLineTokenStatus, getLineBotInfo, sendLineNotification } from '../lib/api'

// ===== スタッフ管理タブ（admin のみ） =====
const ROLE_LABELS = { admin: '管理者', staff: 'スタッフ' }
const ROLE_COLORS = { admin: '#4a7c59', staff: '#c4a35a' }

function StaffManagementTab({ currentUserEmail }) {
    const [staffList, setStaffList] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ email: '', name: '', role: 'staff' })
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true)
        setStaffList(await getStaff())
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    async function handleAdd(e) {
        e.preventDefault()
        setError('')
        setAdding(true)
        const res = await addStaff(form)
        if (res.success) {
            setForm({ email: '', name: '', role: 'staff' })
            await load()
        } else {
            setError(res.error || '追加に失敗しました')
        }
        setAdding(false)
    }

    async function handleRoleChange(email, newRole) {
        await updateStaff(email, { role: newRole })
        await load()
    }

    async function handleToggleActive(email, currentActive) {
        await updateStaff(email, { active: !currentActive })
        await load()
    }

    if (loading) return <div style={{ padding: 'var(--sp-8)', textAlign: 'center' }}><div className="loading-spinner" /></div>

    return (
        <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
            {/* スタッフ追加フォーム */}
            <div className="card">
                <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--sp-2)' }}>
                    スタッフを追加
                </h2>
                <form onSubmit={handleAdd}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 'var(--sp-3)', alignItems: 'end' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">メールアドレス</label>
                            <input
                                type="email" className="form-input" required
                                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                placeholder="staff@example.com"
                            />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">名前</label>
                            <input
                                type="text" className="form-input" required
                                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="田中 花子"
                            />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">権限</label>
                            <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                                <option value="staff">スタッフ</option>
                                <option value="admin">管理者</option>
                            </select>
                        </div>
                        <button type="submit" className="action-btn success" disabled={adding} style={{ whiteSpace: 'nowrap' }}>
                            {adding ? '追加中...' : '追加'}
                        </button>
                    </div>
                    {error && <p style={{ color: 'var(--error-color)', marginTop: 'var(--sp-2)', fontSize: '0.9rem' }}>{error}</p>}
                </form>
            </div>

            {/* スタッフ一覧 */}
            <div className="card">
                <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--sp-2)' }}>
                    スタッフ一覧 <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>({staffList.length}名)</span>
                </h2>
                <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                    {staffList.map(s => {
                        const isMe = s.email === currentUserEmail?.toLowerCase()
                        const isActive = s.active !== false
                        return (
                            <div key={s.id} style={{
                                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                                alignItems: 'center', gap: 'var(--sp-3)',
                                padding: 'var(--sp-3) var(--sp-4)',
                                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                borderRadius: '8px', border: '1px solid var(--border-color)',
                                opacity: isActive ? 1 : 0.55
                            }}>
                                {/* 名前・メール */}
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                        {s.name}
                                        {isMe && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(あなた)</span>}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.email}</div>
                                </div>

                                {/* ロールバッジ */}
                                <span style={{
                                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600,
                                    background: ROLE_COLORS[s.role] + '22', color: ROLE_COLORS[s.role]
                                }}>
                                    {ROLE_LABELS[s.role] || s.role}
                                </span>

                                {/* ロール変更（自分自身は変更不可） */}
                                <select
                                    className="form-input"
                                    style={{ fontSize: '0.85rem', padding: '4px 8px', width: 'auto' }}
                                    value={s.role}
                                    disabled={isMe}
                                    onChange={e => handleRoleChange(s.email, e.target.value)}
                                    title={isMe ? '自分自身の権限は変更できません' : ''}
                                >
                                    <option value="staff">スタッフ</option>
                                    <option value="admin">管理者</option>
                                </select>

                                {/* 有効/無効トグル（自分自身は操作不可） */}
                                <button
                                    className={`action-btn ${isActive ? 'danger' : 'success'}`}
                                    style={{ fontSize: '0.8rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
                                    disabled={isMe}
                                    onClick={() => handleToggleActive(s.email, isActive)}
                                    title={isMe ? '自分自身は無効化できません' : ''}
                                >
                                    {isActive ? '無効化' : '有効化'}
                                </button>
                            </div>
                        )
                    })}
                    {staffList.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-6)' }}>スタッフが登録されていません</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// ===== 外部連携タブ（admin のみ） =====
const cardStyle = { background: 'var(--bg-secondary)', borderRadius: '10px', padding: 'var(--sp-5)', border: '1px solid var(--border-color)', marginBottom: 'var(--sp-4)' }
const cardTitleStyle = { fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--sp-4)', paddingBottom: 'var(--sp-2)', borderBottom: '1px solid var(--border-color)' }
const hintStyle = { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }

function IntegrationsTab() {
    const [fields, setFields] = useState({ calendarId: '', lineGroupId: '', gasApiUrl: '', gasSecret: '', notificationEmails: '' })
    const [newToken, setNewToken] = useState('')
    const [showTokenInput, setShowTokenInput] = useState(false)
    const [tokenStatus, setTokenStatus] = useState({ hasToken: false })
    const [saving, setSaving] = useState(false)
    const [savingToken, setSavingToken] = useState(false)
    const [testing, setTesting] = useState(false)
    const [msg, setMsg] = useState({ text: '', ok: true })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            // settings を先に取得（GAS URL がキャッシュされる）
            const s = await getSystemSettings()
            setFields(prev => ({
                ...prev,
                calendarId:         s.calendarId         || '',
                lineGroupId:        s.lineGroupId         || '',
                gasApiUrl:          s.gasApiUrl           || '',
                gasSecret:          s.gasSecret           || '',
                notificationEmails: s.notificationEmails  || ''
            }))
            // settings キャッシュ済みなので GAS URL が使える
            const ts = await getLineTokenStatus()
            setTokenStatus(ts || { hasToken: false })
            if (!ts?.hasToken) setShowTokenInput(true)
            setLoading(false)
        }
        load()
    }, [])

    const setMessage = (text, ok = true) => setMsg({ text, ok })
    const handleChange = e => setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await updateSystemSettings(fields)
            setMessage('設定を保存しました')
        } catch { setMessage('保存に失敗しました', false) }
        finally { setSaving(false) }
    }

    async function handleSaveToken() {
        if (!newToken.trim()) return
        setSavingToken(true)
        try {
            const result = await saveLineToken(newToken.trim())
            if (result?.ok || result?.success) {
                setTokenStatus({ hasToken: true })
                setNewToken('')
                setShowTokenInput(false)
                setMessage('LINEトークンを保存しました')
            } else {
                setMessage('トークン保存失敗: ' + (result?.error || '不明なエラー'), false)
            }
        } catch { setMessage('トークン保存に失敗しました', false) }
        finally { setSavingToken(false) }
    }

    async function handleTestLine() {
        if (!fields.lineGroupId) { setMessage('LINEグループIDを入力してください', false); return }
        setTesting(true)
        try {
            const testMsg = `【テスト送信】\n酵素風呂予約システムからの接続確認です。\n送信時刻: ${new Date().toLocaleString('ja-JP')}`
            const result = await sendLineNotification(testMsg, fields.lineGroupId)
            if (result?.ok || result?.success) {
                setMessage('テスト送信成功！LINEグループをご確認ください')
            } else {
                setMessage('テスト送信失敗: ' + (result?.error || '不明なエラー'), false)
            }
        } catch { setMessage('テスト送信に失敗しました', false) }
        finally { setTesting(false) }
    }

    if (loading) return <div style={{ padding: 'var(--sp-8)', textAlign: 'center' }}><div className="loading-spinner" /></div>

    return (
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            {/* Google カレンダー */}
            <div style={cardStyle}>
                <h3 style={cardTitleStyle}>Google カレンダー設定</h3>
                <div className="form-group">
                    <label className="form-label">カレンダーID</label>
                    <input type="text" name="calendarId" className="form-input"
                        value={fields.calendarId} onChange={handleChange}
                        placeholder="primary または xxxx@group.calendar.google.com" />
                    <p style={hintStyle}>空欄の場合はアカウントのメインカレンダーを使用。カレンダーID は Googleカレンダー設定 → 「カレンダーの統合」で確認できます。</p>
                </div>
            </div>

            {/* LINE 通知 */}
            <div style={cardStyle}>
                <h3 style={cardTitleStyle}>LINE 通知設定</h3>
                <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                    <label className="form-label">LINEグループID</label>
                    <input type="text" name="lineGroupId" className="form-input"
                        value={fields.lineGroupId} onChange={handleChange}
                        placeholder="C xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    <p style={hintStyle}>「C」で始まるグループIDを入力。取得方法は下のヒントを参照。</p>
                    <details style={{ marginTop: 'var(--sp-2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>💡 グループIDの取得方法</summary>
                        <div style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', lineHeight: 1.7 }}>
                            <p>1. LINE Developers Console → 対象チャネル → <strong>Messaging API</strong></p>
                            <p>2. <strong>Webhook URL</strong> に以下のようなサービスを設定:</p>
                            <p style={{ paddingLeft: 'var(--sp-3)' }}>
                                <a href="https://webhook.site" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>webhook.site</a>
                                （無料・登録不要のリクエスト確認サービス）
                            </p>
                            <p>3. LINEグループでボットに何かメッセージを送信</p>
                            <p>4. webhook.site の画面でリクエスト内容を確認 →<br/>
                                <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>events[0].source.groupId</code> がグループIDです</p>
                            <p>5. 取得後、Webhook URL を GAS の URL に戻してください</p>
                        </div>
                    </details>
                </div>
                <div className="form-group">
                    <label className="form-label">Channel Access Token</label>
                    {tokenStatus.hasToken && !showTokenInput ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#e6f4ea', color: '#2d7a4f', fontSize: '0.85rem', fontWeight: 600 }}>設定済み</span>
                            <button type="button" className="action-btn" style={{ fontSize: '0.85rem', padding: '4px 12px' }}
                                onClick={() => setShowTokenInput(true)}>変更する</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                            <input type="password" className="form-input" autoComplete="off"
                                value={newToken} onChange={e => setNewToken(e.target.value)}
                                placeholder="LINE Messaging API の Channel Access Token"
                                style={{ flex: 1 }} />
                            <button type="button" className="action-btn success" disabled={savingToken || !newToken.trim()}
                                style={{ whiteSpace: 'nowrap' }} onClick={handleSaveToken}>
                                {savingToken ? '保存中...' : '保存'}
                            </button>
                            {tokenStatus.hasToken && (
                                <button type="button" className="action-btn" onClick={() => { setShowTokenInput(false); setNewToken('') }}>キャンセル</button>
                            )}
                        </div>
                    )}
                    <p style={hintStyle}>Messaging API チャネルの「Channel Access Token」。このトークンはサーバー側のみに保存されます。</p>
                </div>
                <div style={{ marginTop: 'var(--sp-3)' }}>
                    <button type="button" className="action-btn" disabled={testing || !fields.lineGroupId}
                        onClick={handleTestLine}>
                        {testing ? '送信中...' : '🔔 LINEテスト送信'}
                    </button>
                </div>
            </div>

            {/* GAS 接続設定 */}
            <div style={cardStyle}>
                <h3 style={cardTitleStyle}>GAS 接続設定</h3>
                <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                    <label className="form-label">GAS API URL</label>
                    <input type="url" name="gasApiUrl" className="form-input"
                        value={fields.gasApiUrl} onChange={handleChange}
                        placeholder="https://script.google.com/macros/s/.../exec" />
                    <p style={hintStyle}>GASウェブアプリとしてデプロイした際のURL。空欄の場合は初期設定値（.env）を使用。</p>
                </div>
                <div className="form-group">
                    <label className="form-label">GAS 認証シークレット</label>
                    <input type="password" name="gasSecret" className="form-input" autoComplete="off"
                        value={fields.gasSecret} onChange={handleChange}
                        placeholder="空欄の場合は初期設定値を使用" />
                    <p style={hintStyle}>GASスクリプト内の CALENDAR_SECRET と一致する値。</p>
                </div>
            </div>

            {/* 管理者通知メール */}
            <div style={cardStyle}>
                <h3 style={cardTitleStyle}>管理者通知メール</h3>
                <div className="form-group">
                    <label className="form-label">通知先メールアドレス（カンマ区切り）</label>
                    <input type="text" name="notificationEmails" className="form-input"
                        value={fields.notificationEmails} onChange={handleChange}
                        placeholder="admin@example.com, staff@example.com" />
                    <p style={hintStyle}>新規予約・リクエスト時にメール通知を送る宛先。複数の場合はカンマで区切ってください。</p>
                </div>
            </div>

            {/* メッセージ */}
            {msg.text && (
                <p style={{ color: msg.ok ? '#2d7a4f' : 'var(--error-color)', fontSize: '0.9rem', padding: 'var(--sp-3)', background: msg.ok ? '#e6f4ea' : '#fdecea', borderRadius: '8px' }}>
                    {msg.text}
                </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="action-btn success" style={{ padding: 'var(--sp-3) var(--sp-8)', fontSize: '1.1rem' }} disabled={saving}>
                    {saving ? '保存中...' : '設定を保存する'}
                </button>
            </div>
        </form>
    )
}

// ===== メインページ =====
const TABS = [
    { id: 'staff', label: '👥 スタッフ管理' },
    { id: 'integrations', label: '🔗 外部連携' }
]

export default function AdminSettings() {
    const { role, user } = useRole()
    const [activeTab, setActiveTab] = useState('staff')

    if (role !== 'admin') {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-content">
                    <div style={{ textAlign: 'center', padding: 'var(--sp-16)', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--sp-4)' }}>🔒</div>
                        <p>この画面は管理者のみアクセスできます。</p>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                <div style={{ marginBottom: 'var(--sp-6)' }}>
                    <h1 className="admin-page-title" style={{ marginBottom: 'var(--sp-1)' }}>⚙️ システム設定</h1>
                    <p className="admin-page-desc" style={{ margin: 0 }}>スタッフアカウントと外部サービス連携を管理します</p>
                </div>

                {/* タブ切り替え */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--sp-5)', borderBottom: '2px solid var(--border-color)' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: 'var(--sp-2) var(--sp-5)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '0.95rem', fontWeight: activeTab === tab.id ? 700 : 400,
                                color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                marginBottom: '-2px', transition: 'all 150ms ease'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'staff' && <StaffManagementTab currentUserEmail={user?.email} />}
                {activeTab === 'integrations' && <IntegrationsTab />}
            </main>
        </div>
    )
}
