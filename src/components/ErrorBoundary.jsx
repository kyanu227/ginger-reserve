/**
 * React エラーバウンダリ
 * レンダリングエラーをキャッチし、logger.js でログ送信 + フォールバックUI表示
 */
import React from 'react';
import logger from '../lib/logger';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Automatically send the crash report
        logger.error('React ErrorBoundary Caught Error', {
            error: error.toString(),
            componentStack: errorInfo.componentStack
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font)', color: 'var(--text)' }}>
                    <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>システムエラーが発生しました</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        ご不便をおかけして申し訳ありません。<br />
                        エラー内容は自動的に管理者に送信されました。<br />
                        もう一度やり直すか、時間をおいてお試しください。
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'var(--primary)',
                            color: '#fff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        ページを再読み込みする
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <pre style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'left', overflow: 'auto' }}>
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
