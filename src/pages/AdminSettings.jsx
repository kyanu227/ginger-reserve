import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getSystemSettings, updateSystemSettings } from '../lib/api'

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        repeaterMenuName: '',
        repeaterDiscountAmount: '',
        repeaterOptionName: '',
        repeaterOptionPrice: '',
        '営業開始': '',
        '営業終了': ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const data = await getSystemSettings()
            if (data && Object.keys(data).length > 0) {
                setSettings(prev => ({ ...prev, ...data }))
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setSettings(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await updateSystemSettings(settings)
            alert('設定を保存しました。')
        } catch (err) {
            console.error(err)
            alert('設定の保存に失敗しました。')
        } finally {
            setSaving(false)
        }
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
                    <div>
                        <h1 className="admin-page-title" style={{ marginBottom: 'var(--sp-1)' }}>⚙️ システム設定</h1>
                        <p className="admin-page-desc" style={{ margin: 0 }}>アプリ全体の設定、リピーター料金の管理を行います</p>
                    </div>
                </div>

                <div className="card">
                    <form onSubmit={handleSave}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--sp-2)' }}>
                            基本設定
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
                            <div className="form-group">
                                <label className="form-label">営業開始時間</label>
                                <input
                                    type="time"
                                    name="営業開始"
                                    className="form-input"
                                    value={settings['営業開始'] || ''}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">営業終了時間</label>
                                <input
                                    type="time"
                                    name="営業終了"
                                    className="form-input"
                                    value={settings['営業終了'] || ''}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--sp-2)' }}>
                            リピーター設定 (2回目以降)
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
                            ※ログインしているお客様が、過去に予約履歴を持っている場合に自動で適用される金額とメニュー名です。
                        </p>

                        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                            <div className="form-group">
                                <label className="form-label">表示されるメニュー名</label>
                                <input
                                    type="text"
                                    name="repeaterMenuName"
                                    className="form-input"
                                    value={settings.repeaterMenuName || ''}
                                    onChange={handleChange}
                                    placeholder="例: 酵素風呂 (2回目以降)"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">基本料金 (円)</label>
                                <input
                                    type="number"
                                    name="repeaterDiscountAmount"
                                    className="form-input"
                                    value={settings.repeaterDiscountAmount || ''}
                                    onChange={handleChange}
                                    placeholder="例: 2900"
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--sp-4)' }}>
                                <label className="form-label">追加オプション名 (任意 / 酵素着持参割引等)</label>
                                <input
                                    type="text"
                                    name="repeaterOptionName"
                                    className="form-input"
                                    value={settings.repeaterOptionName || ''}
                                    onChange={handleChange}
                                    placeholder="例: 自前酵素着持参（割引）"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">追加オプション料金 (割引の場合はマイナスを入力)</label>
                                <input
                                    type="number"
                                    name="repeaterOptionPrice"
                                    className="form-input"
                                    value={settings.repeaterOptionPrice || ''}
                                    onChange={handleChange}
                                    placeholder="例: -1000"
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--sp-8)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="submit"
                                className="action-btn success"
                                style={{ padding: 'var(--sp-3) var(--sp-8)', fontSize: '1.1rem' }}
                                disabled={saving}
                            >
                                {saving ? '保存中...' : '設定を保存する'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
