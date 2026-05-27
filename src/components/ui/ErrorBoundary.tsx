import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-chance error boundary. Catches anything React would otherwise
 * unmount the whole tree for and shows a recoverable card instead of a
 * blank page.
 *
 * Errors are logged to the console (and would forward to Sentry / similar
 * if VITE_SENTRY_DSN were set — that's where the integration would go).
 * "Try again" calls window.location.reload because most app crashes are
 * cleared by re-running the app shell against the persisted cache.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Forward to an error reporter if one is configured.
    // window.Sentry?.captureException(error, { extra: info });
    console.error('[ErrorBoundary] uncaught', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg text-fg">
        <div className="max-w-md w-full card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-fg))' }}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="display text-[20px] leading-none">Something went wrong</h1>
              <p className="text-xs text-fg-muted mt-1">
                ProTrack hit an unexpected error. Your data is safe.
              </p>
            </div>
          </div>
          <pre className="bg-surface border border-border rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-32 text-fg-muted">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </button>
            <button
              className="btn-secondary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
