import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ADMIN_EMAILS } from '../lib/config'

export default function AdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // 管理者メールアドレスかチェック
            if (!ADMIN_EMAILS.includes(user.email)) {
                await signOut(auth) // 管理者でなければ即ログアウト
                setError('このアカウントには管理者権限がありません')
            }
        } catch (err) {
            console.error('Login error:', err)
            switch (err.code) {
                case 'auth/invalid-email':
                    setError('メールアドレスの形式が正しくありません')
                    break
                case 'auth/user-not-found':
                    setError('登録されていないメールアドレスです')
                    break
                case 'auth/wrong-password':
                    setError('パスワードが正しくありません')
                    break
                case 'auth/invalid-credential':
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
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="login-icon">🔒</span>
                    <h1>管理画面ログイン</h1>
                    <p>管理者アカウントでログインしてください</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="login-error">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="login-field">
                        <label htmlFor="email">メールアドレス</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">パスワード</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="パスワードを入力"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="login-button-loading">
                                <span className="loading-spinner-small"></span>
                                ログイン中...
                            </span>
                        ) : (
                            'ログイン'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
