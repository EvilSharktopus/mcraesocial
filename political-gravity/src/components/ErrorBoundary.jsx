import { Component } from 'react';

// Without this, any render error unmounts the whole app and leaves a blank
// page with no explanation — the failure mode is indistinguishable from a
// dead site. Show the message instead so it can be reported.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <div className="w-full max-w-md rounded-2xl p-6"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>
            Something went wrong
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--pg-dim)' }}>
            The page failed to load. Try reloading — if it keeps happening, send Mr. McRae the message below.
          </p>
          <pre className="text-xs mt-4 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap"
            style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-muted)' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
