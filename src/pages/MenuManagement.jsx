import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import { getMenus, getOptions, updateMenus, updateOptionsData, formatPrice } from '../lib/api'

export default function MenuManagement() {
    const [menus, setMenus] = useState([])
    const [options, setOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState('menus')

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [m, o] = await Promise.all([getMenus(), getOptions()])
            setMenus(m)
            setOptions(o)
            setLoading(false)
        }
        load()
    }, [])

    function updateMenuItem(index, field, value) {
        setMenus(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
    }

    function addMenu() {
        setMenus(prev => [...prev, {
            id: 'menu-' + Date.now(),
            name: '',
            category: 'main',
            price: 0,
            duration: 20,
            description: '',
            icon: '🌿',
            active: true
        }])
    }

    function removeMenu(index) {
        if (confirm('このメニューを削除しますか？')) {
            setMenus(prev => prev.filter((_, i) => i !== index))
        }
    }

    function updateOptionItem(index, field, value) {
        setOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o))
    }

    function addOption() {
        setOptions(prev => [...prev, {
            id: 'opt-' + Date.now(),
            name: '',
            price: 0,
            description: '',
            icon: '✨',
            constraint: '',
            active: true
        }])
    }

    function removeOption(index) {
        if (confirm('このオプションを削除しますか？')) {
            setOptions(prev => prev.filter((_, i) => i !== index))
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            if (tab === 'menus') {
                await updateMenus(menus)
            } else {
                await updateOptionsData(options)
            }
            alert('保存しました')
        } catch (err) {
            alert('保存に失敗しました')
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                    <div>
                        <h1 style={{ marginBottom: 'var(--sp-1)' }}>🍽️ メニュー管理</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>コースとオプションの料金・内容を編集できます</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '💾 保存する'}
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
                    <button className={`btn ${tab === 'menus' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTab('menus')}>コースメニュー ({menus.length})</button>
                    <button className={`btn ${tab === 'options' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTab('options')}>オプション ({options.length})</button>
                </div>

                {/* Menus Tab */}
                {tab === 'menus' && (
                    <div>
                        {menus.map((menu, i) => (
                            <div key={menu.id} className="card" style={{ marginBottom: 'var(--sp-4)', opacity: menu.active ? 1 : 0.6 }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-4)' }}>
                                    <h3>{menu.icon} {menu.name || '新規メニュー'}</h3>
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={menu.active}
                                                onChange={e => updateMenuItem(i, 'active', e.target.checked)} />
                                            有効
                                        </label>
                                        <button className="btn btn-secondary interactive-element" style={{ color: '#c0392b', padding: '4px 12px' }}
                                            onClick={() => removeMenu(i)}>🗑️</button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">メニュー名</label>
                                        <input className="form-input" value={menu.name}
                                            onChange={e => updateMenuItem(i, 'name', e.target.value)} placeholder="酵素風呂（初回）" />
                                    </div>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">アイコン</label>
                                        <input className="form-input" value={menu.icon}
                                            onChange={e => updateMenuItem(i, 'icon', e.target.value)} placeholder="🌿" style={{ maxWidth: 100 }} />
                                    </div>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">料金（円）</label>
                                        <input className="form-input" type="number" value={menu.price}
                                            onChange={e => updateMenuItem(i, 'price', Number(e.target.value))} />
                                    </div>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">所要時間（分）</label>
                                        <input className="form-input" type="number" value={menu.duration}
                                            onChange={e => updateMenuItem(i, 'duration', Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="form-group interactive-element">
                                    <label className="form-label">説明文</label>
                                    <textarea className="form-input" rows="2" value={menu.description}
                                        onChange={e => updateMenuItem(i, 'description', e.target.value)} />
                                </div>
                            </div>
                        ))}

                        <button className="btn btn-secondary" onClick={addMenu} style={{ width: '100%', padding: 'var(--sp-4)', border: '2px dashed var(--border-color)' }}>
                            ＋ メニューを追加
                        </button>
                    </div>
                )}

                {/* Options Tab */}
                {tab === 'options' && (
                    <div>
                        {options.map((opt, i) => (
                            <div key={opt.id} className="card" style={{ marginBottom: 'var(--sp-4)', opacity: opt.active ? 1 : 0.6 }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-4)' }}>
                                    <h3>{opt.icon} {opt.name || '新規オプション'}</h3>
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={opt.active}
                                                onChange={e => updateOptionItem(i, 'active', e.target.checked)} />
                                            有効
                                        </label>
                                        <button className="btn btn-secondary interactive-element" style={{ color: '#c0392b', padding: '4px 12px' }}
                                            onClick={() => removeOption(i)}>🗑️</button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">オプション名</label>
                                        <input className="form-input" value={opt.name}
                                            onChange={e => updateOptionItem(i, 'name', e.target.value)} />
                                    </div>
                                    <div className="form-group interactive-element">
                                        <label className="form-label">料金（円）</label>
                                        <input className="form-input" type="number" value={opt.price}
                                            onChange={e => updateOptionItem(i, 'price', Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="form-group interactive-element">
                                    <label className="form-label">説明</label>
                                    <input className="form-input" value={opt.description}
                                        onChange={e => updateOptionItem(i, 'description', e.target.value)} />
                                </div>
                                <div className="form-group interactive-element">
                                    <label className="form-label">制約</label>
                                    <select className="form-input" value={opt.constraint}
                                        onChange={e => updateOptionItem(i, 'constraint', e.target.value)}>
                                        <option value="">制約なし</option>
                                        <option value="enzyme-before">酵素風呂の入浴前のみ</option>
                                    </select>
                                </div>
                            </div>
                        ))}

                        <button className="btn btn-secondary" onClick={addOption} style={{ width: '100%', padding: 'var(--sp-4)', border: '2px dashed var(--border-color)' }}>
                            ＋ オプションを追加
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
