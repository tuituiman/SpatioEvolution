import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * ErrorBoundary — ป้องกัน white screen เมื่อ component crash
 * ครอบทั้ง App เพื่อ catch runtime errors จาก React tree
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: '#0f172a',
            color: '#f1f5f9',
            fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
            padding: '2rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>
            เกิดข้อผิดพลาดในระบบ
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem', textAlign: 'center' }}>
            กรุณาลอง Refresh หน้าเว็บ หากปัญหายังเกิดขึ้น ให้ลองล้างข้อมูล cache ของ browser
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#1e293b',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.75rem',
                color: '#fca5a5',
                maxWidth: '600px',
                width: '100%',
                overflow: 'auto',
                marginBottom: '1.5rem',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 2rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Refresh หน้าเว็บ
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
