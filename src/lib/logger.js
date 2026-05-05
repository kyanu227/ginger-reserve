/**
 * ログユーティリティ
 * ErrorBoundary.jsx から使用。GAS 経由でエラーログを送信
 */
import { GAS_API_URL } from './api';

class Logger {
    constructor() {
        this.buffer = [];
        this.isFlushing = false;

        // Auto-attach global listeners in production
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
            window.addEventListener('error', this.handleGlobalError.bind(this));
            window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
        }
    }

    handleGlobalError(event) {
        this.error('Uncaught Exception', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error ? event.error.stack : null
        });
    }

    handlePromiseRejection(event) {
        this.error('Unhandled Promise Rejection', {
            reason: event.reason ? (event.reason.stack || event.reason.message || event.reason) : 'Unknown reason'
        });
    }

    info(message, context = {}) {
        this.log('INFO', message, context);
    }

    warn(message, context = {}) {
        this.log('WARN', message, context);
    }

    error(message, context = {}) {
        this.log('ERROR', message, context);
    }

    log(level, message, context = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: JSON.stringify(context),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Also log to console for local debugging
        console[level.toLowerCase()](`[${level}] ${message}`, context);

        this.buffer.push(entry);
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (!this.isFlushing) {
            this.isFlushing = true;
            // Debounce the actual sending to batch multiple rapid errors
            setTimeout(() => this.flush(), 2000);
        }
    }

    async flush() {
        if (this.buffer.length === 0 || !GAS_API_URL) {
            this.isFlushing = false;
            return;
        }

        const logsToSend = [...this.buffer];
        this.buffer = [];

        try {
            await fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'logError',
                    logs: logsToSend
                }),
                // Don't wait for a clean response, just fire and forget
                keepalive: true
            });
        } catch (err) {
            console.error('Failed to send logs to backend:', err);
            // Put logs back into buffer if failed
            this.buffer = [...logsToSend, ...this.buffer];
        } finally {
            this.isFlushing = false;
        }
    }
}

const logger = new Logger();
export default logger;
