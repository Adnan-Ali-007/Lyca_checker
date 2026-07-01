import { useEffect, useRef } from 'react'
import api from '../api'
import { Loader2 } from 'lucide-react'

export default function ProgressSection({ jobId, progress, setProgress, onComplete }) {
  const intervalRef = useRef(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/api/job/${jobId}`, { params: { _t: Date.now() } })
        setProgress({
          total: data.total,
          completed: data.completed,
          valid: data.valid,
          invalid: data.invalid,
        })
        if (data.status === 'done') {
          clearInterval(intervalRef.current)
          onComplete({ total: data.total, completed: data.completed, valid: data.valid, invalid: data.invalid })
        }
      } catch (_) {}
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => clearInterval(intervalRef.current)
  }, [jobId])

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div style={{ width: '100%', maxWidth: 520, marginTop: 80 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Verifying numbers...</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {progress.completed} of {progress.total} checked
        </p>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Progress</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 100, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 100,
            background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
            transition: 'width 0.6s ease',
            boxShadow: '0 0 12px var(--accent-glow)',
          }} />
        </div>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>
          Total: {progress.total.toLocaleString()} numbers
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
