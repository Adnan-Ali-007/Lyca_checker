import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UploadSection from './components/UploadSection'
import ProgressSection from './components/ProgressSection'
import ResultsSection from './components/ResultsSection'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <MainApp />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

// ── Route guard ──────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { auth } = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return children
}

// ── Main application (post-login) ────────────────────────────────────────────
// Stages: idle | processing | done
function MainApp() {
  const [stage, setStage] = useState('idle')
  const [jobId, setJobId] = useState(null)
  const [progress, setProgress] = useState({ total: 0, completed: 0, valid: 0, invalid: 0 })

  const handleUploadSuccess = (id, total) => {
    setJobId(id)
    setProgress({ total, completed: 0, valid: 0, invalid: 0 })
    setStage('processing')
  }

  const handleComplete = (finalProgress) => {
    setProgress(finalProgress)
    setStage('done')
  }

  const handleReset = () => {
    setStage('idle')
    setJobId(null)
    setProgress({ total: 0, completed: 0, valid: 0, invalid: 0 })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px' }}>
        {stage === 'idle' && <UploadSection onSuccess={handleUploadSuccess} />}
        {stage === 'processing' && (
          <ProgressSection jobId={jobId} progress={progress} setProgress={setProgress} onComplete={handleComplete} />
        )}
        {stage === 'done' && (
          <ResultsSection jobId={jobId} progress={progress} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}

function Header() {
  const { auth, logout } = useAuth()

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '18px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(17,17,24,0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: '#fff',
        boxShadow: '0 0 16px var(--accent-glow)'
      }}>L</div>
      <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.3px' }}>Number Validator</span>
      <span style={{
        marginLeft: 8, fontSize: 11, fontWeight: 500,
        background: 'var(--accent-dim)', color: 'var(--accent)',
        padding: '2px 8px', borderRadius: 20,
        border: '1px solid rgba(108,99,255,0.3)'
      }}>Prod</span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User info + logout */}
      {auth && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{auth.user.name}</span>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '5px 12px',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
