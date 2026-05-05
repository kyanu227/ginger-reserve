/**
 * 管理画面ログイン
 * メール/パスワード or Google ログイン。AuthGuard から未認証時に表示される
 * 関連: lib/firebase.js, components/AuthGuard.jsx
 */
import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../lib/firebase'

const googleProvider = new GoogleAuthProvider()

export default function AdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)

    // メール＋パスワード
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await signInWithEmailAndPassword(auth, email, password)
            // 認証成功 → RoleContext が staff/{email} を確認してアクセス可否を判断
        } catch (err) {
            console.error('Login error:', err)
            switch (err.code) {
                case 'auth/invalid-email':      setError('メールアドレスの形式が正しくありません'); break
                case 'auth/user-not-found':     setError('登録されていないメールアドレスです'); break
                case 'auth/wrong-password':     setError('パスワードが正しくありません'); break
                case 'auth/invalid-credential': setError('メールアドレスまたはパスワードが正しくありません'); break
                case 'auth/too-many-requests':  setError('ログイン試行回数が多すぎます。しばらく時間をおいてください'); break
                default:                        setError('ログインに失敗しました')
            }
        } finally {
            setLoading(false)
        }
    }

    // Google ログイン
    const handleGoogle = async () => {
        setError('')
        setGoogleLoading(true)
        try {
            await signInWithPopup(auth, googleProvider)
            // 認証成功 → RoleContext が staff/{email} を確認してアクセス可否を判断
        } catch (err) {
            console.error('Google login error:', err)
            if (err.code !== 'auth/popup-closed-by-user') {
                setError('Google ログインに失敗しました')
            }
        } finally {
            setGoogleLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="login-icon">🔒</span>
                    <h1>管理画面ログイン</h1>
                    <p>管理者アカウントでログインしてください</p>
                </div>

                {error && (
                    <div className="login-error">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Google ログイン */}
                <button
                    type="button"
                    className="login-button"
                    onClick={handleGoogle}
                    disabled={googleLoading || loading}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        background: '#fff', color: '#3c4043', border: '1px solid #dadce0',
                        marginBottom: 16, fontWeight: 500
                    }}
                >
                    {googleLoading ? (
                        <span className="login-button-loading">
                            <span className="loading-spinner-small"></span>
                            ログイン中...
                        </span>
                    ) : (
                        <>
                            {/* Google SVG ロゴ */}
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
                                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                            </svg>
                            Google でログイン
                        </>
                    )}
                </button>

                {/* 区切り線 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>またはメールで</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                </div>

                {/* メール＋パスワード */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="email">メールアドレス</label>
                        <input
                            id="email" type="email" value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required autoComplete="email"
                        />
                    </div>
                    <div className="login-field">
                        <label htmlFor="password">パスワード</label>
                        <input
                            id="password" type="password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="パスワードを入力"
                            required autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading || googleLoading}>
                        {loading ? (
                            <span className="login-button-loading">
                                <span className="loading-spinner-small"></span>
                                ログイン中...
                            </span>
                        ) : 'ログイン'}
                    </button>
                </form>
            </div>
        </div>
    )
}
