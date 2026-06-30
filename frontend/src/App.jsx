import { useState } from 'react'
import UploadSection from './components/UploadSection'
import ProgressSection from './components/ProgressSection'
import ResultsSection from './components/ResultsSection'
import './index.css'

// Stages: idle | processing | done
export default function App() {
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
    </header>
  )
}
