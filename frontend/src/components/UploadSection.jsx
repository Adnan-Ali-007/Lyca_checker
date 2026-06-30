import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Upload, FileText, AlertCircle } from 'lucide-react'

export default function UploadSection({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted, rejected) => {
    setError('')
    if (rejected.length > 0) {
      setError('Only .txt or .pdf files are accepted.')
      return
    }
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post('/api/upload', form, { timeout: 30000 })
      onSuccess(data.jobId, data.total)
    } catch (e) {
      setError(e.response?.data?.message || 'Upload failed. Is the backend running?')
      setUploading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 560, marginTop: 60 }}>
      {/* Hero text */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.15 }}>
          Validate Lyca<br />
          <span style={{ color: 'var(--accent)' }}>phone numbers</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>
          Upload a TXT or PDF with phone numbers.<br />
          We will give u back verified valid phone numbers.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? 'var(--accent)' : file ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 16,
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'var(--accent-dim)' : file ? 'var(--green-dim)' : 'var(--surface)',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        <input {...getInputProps()} />
        {file ? (
          <>
            <FileText size={40} color="var(--green)" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>{file.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : 'Size loading...'} — click or drop to replace
            </p>
          </>
        ) : (
          <>
            <Upload size={40} color={isDragActive ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>
              {isDragActive ? 'Drop it here' : 'Drop your file here'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
              TXT or PDF · up to 50 MB
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 16, padding: '12px 16px',
          background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, color: 'var(--red)', fontSize: 13
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        style={{
          marginTop: 20,
          width: '100%',
          padding: '14px',
          borderRadius: 12,
          border: 'none',
          background: file && !uploading ? 'var(--accent)' : 'var(--surface2)',
          color: file && !uploading ? '#fff' : 'var(--text-muted)',
          fontWeight: 600,
          fontSize: 15,
          cursor: file && !uploading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          boxShadow: file && !uploading ? '0 0 24px var(--accent-glow)' : 'none',
          letterSpacing: '-0.2px',
        }}
      >
        {uploading ? 'Uploading...' : 'Start Verification →'}
      </button>
    </div>
  )
}
