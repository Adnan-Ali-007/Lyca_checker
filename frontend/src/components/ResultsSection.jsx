import { CheckCircle2, Download, RotateCcw } from 'lucide-react'

export default function ResultsSection({ jobId, progress, onReset }) {
  const download = (format) => {
    // Token passed as query param because window.open can't set headers
    let token = ''
    try {
      const stored = localStorage.getItem('auth')
      if (stored) token = JSON.parse(stored).token || ''
    } catch { /* ignore */ }

    const base = import.meta.env.VITE_API_URL || ''
    window.open(`${base}/api/download/${jobId}?format=${format}&token=${token}`, '_blank')
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, marginTop: 80 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--green-dim)', marginBottom: 16,
          border: '1px solid rgba(34,197,94,0.3)',
        }}>
          <CheckCircle2 size={28} color="var(--green)" />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>Done</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
          Found <span style={{ color: 'var(--green)', fontWeight: 600 }}>{progress.valid.toLocaleString()}</span> valid numbers out of {progress.total.toLocaleString()}
        </p>
      </div>

      {progress.valid > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => download('txt')}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-dim)'
              e.currentTarget.style.borderColor = 'rgba(108,99,255,0.5)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text)'
            }}
          >
            <Download size={15} />
            Download .txt
          </button>
        </div>
      ) : (
        <div style={{
          padding: '20px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
          marginBottom: 16,
        }}>
          No valid numbers found
        </div>
      )}

      <button
        onClick={onReset}
        style={{
          width: '100%', padding: '13px',
          borderRadius: 12, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-muted)',
          fontWeight: 500, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <RotateCcw size={14} />
        Verify another file
      </button>
    </div>
  )
}
