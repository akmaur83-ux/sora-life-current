import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('BOUNDARY', err && err.message, info && info.componentStack); }
  render() {
    if (this.state.err) return <pre style={{ padding: 20, color: '#c00', whiteSpace: 'pre-wrap' }}>{String(this.state.err && this.state.err.stack)}</pre>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
