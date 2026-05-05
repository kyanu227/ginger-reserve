/**
 * 予約完了画面（お客様向け）
 * ReservationPage から navigate で渡された予約情報を表示
 */
import { useLocation, Link } from 'react-router-dom'
import { formatPrice, formatDate } from '../lib/api'

export default function ReservationConfirm() {
    const { state } = useLocation()

    if (!state) {
        return (
            <main className="page">
                <div className="container" style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
                    <h2>予約情報が見つかりません</h2>
                    <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--sp-6)', display: 'inline-block' }}>
                        トップページへ
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="page">
            <div className="container" style={{ maxWidth: 700 }}>
                <div className="confirm-page">
                    {/* Success Icon */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', color: '#fff',
                            animation: 'fadeInUp 0.4s ease-out'
                        }}>✓</div>
                        <h1 style={{ marginTop: 'var(--sp-5)', fontSize: '1.4rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>ご予約ありがとうございます</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--sp-2)', fontSize: '0.88rem' }}>
                            確認メールをお送りしました
                        </p>
                    </div>

                    {/* Reservation Details */}
                    <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
                        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
                            <span style={{
                                display: 'inline-block', background: 'var(--bg-elevated)',
                                padding: 'var(--sp-2) var(--sp-6)', borderRadius: 'var(--r-full)',
                                fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)',
                                letterSpacing: 2
                            }}>
                                予約番号: {state.id}
                            </span>
                        </div>

                        <table className="confirmation-table" style={{ width: '100%' }}>
                            <tbody>
                                <tr>
                                    <th>コース</th>
                                    <td>{state.menu?.name}</td>
                                </tr>
                                <tr>
                                    <th>人数</th>
                                    <td>{state.form?.guests || 1}名</td>
                                </tr>
                                <tr>
                                    <th>日時</th>
                                    <td>{formatDate(state.form?.date)} {state.form?.time}〜</td>
                                </tr>
                                {state.options && state.options.length > 0 && (
                                    <tr>
                                        <th>オプション</th>
                                        <td>
                                            {state.options.map(opt => (
                                                <div key={opt.id}>{opt.name}（{opt.price === 0 ? '無料' : formatPrice(opt.price)}）</div>
                                            ))}
                                        </td>
                                    </tr>
                                )}
                                <tr>
                                    <th>お名前</th>
                                    <td>{state.form?.lastName} {state.form?.firstName}</td>
                                </tr>
                                {state.form?.phone && (
                                    <tr>
                                        <th>電話番号</th>
                                        <td>{state.form?.phone}</td>
                                    </tr>
                                )}
                                {state.form?.email && (
                                    <tr>
                                        <th>メール</th>
                                        <td>{state.form?.email}</td>
                                    </tr>
                                )}
                                <tr style={{ borderTop: '2px solid var(--primary)' }}>
                                    <th style={{ fontSize: '1.1rem' }}>合計金額</th>
                                    <td style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        {formatPrice(state.totalPrice)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Notice */}
                    <div className="conflict-alert" style={{ borderRadius: '0 var(--r-sm) var(--r-sm) 0' }}>
                        <span className="conflict-alert-icon"></span>
                        <div className="conflict-alert-body">
                        <p style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>ご注意</p>
                        <ul style={{ paddingLeft: 'var(--sp-6)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                            <li>キャンセル・変更はお電話またはメールにてご連絡ください</li>
                            <li>当日は予約時間の5分前までにお越しください</li>
                            <li>お支払いは当日現金にてお願いいたします</li>
                        </ul>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
                        <Link to="/" className="btn btn-primary">トップページへ戻る</Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
