import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../lib/firebase'

export default function CustomerLogin() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleGoogleLogin = async () => {
        setError('')
        setLoading(true)
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)
            navigate('/') // Redirect to reservation page
        } catch (err) {
            console.error('Google login error:', err)
            switch (err.code) {
                case 'auth/popup-closed-by-user':
                    setError('ログインがキャンセルされました')
                    break
                default:
                    setError('Googleログインに失敗しました')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signInWithEmailAndPassword(auth, email, password)
            navigate('/') // Redirect to reservation page
        } catch (err) {
            console.error('Login error:', err)
            switch (err.code) {
                case 'auth/invalid-email':
                    setError('メールアドレスの形式が正しくありません')
                    break
                case 'auth/user-not-found':
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                    setError('メールアドレスまたはパスワードが正しくありません')
                    break
                case 'auth/too-many-requests':
                    setError('ログイン試行回数が多すぎます。しばらく時間をおいてください')
                    break
                default:
                    setError('ログインに失敗しました')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="page">
            <div className="container" style={{ maxWidth: 480, marginTop: 'var(--sp-8)' }}>
                <div className="card">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                        <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-2)' }}>ログイン</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>2回目以降のご利用の方はログインしてください</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                        {error && (
                            <div className="form-error" style={{ background: 'rgba(231,76,60,0.1)', padding: 'var(--sp-3)', borderRadius: 8 }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">メールアドレス</label>
                            <input
                                className="form-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">パスワード</label>
                            <input
                                className="form-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="パスワードを入力"
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 'var(--sp-4)', width: '100%' }}>
                            {loading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--sp-5) 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
                        <span style={{ padding: '0 var(--sp-3)' }}>または</span>
                        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
                    </div>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Googleでログイン
                    </button>

                    <div style={{ marginTop: 'var(--sp-6)', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'grid', gap: 'var(--sp-2)' }}>
                        <p>
                            アカウントをお持ちでないですか？<br />
                            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>新規会員登録はこちら</Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
