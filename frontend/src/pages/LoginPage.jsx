import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || ''

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, form)
      login(data.token, data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" />

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button type="submit" disabled={loading} style={btnStyle(loading)}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 14 }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Request access
        </Link>
      </p>
    </AuthLayout>
  )
}

// ── Shared layout & sub-components ──────────────────────────────────────────

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'var(--bg)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}>L</div>
        <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.3px' }}>Number Validator</span>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, name, type, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)' }}>{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
    </div>
  )
}

export function ErrorBanner({ children }) {
  return (
    <div style={{
      background: 'var(--red-dim)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      color: 'var(--red)',
      fontSize: 13,
    }}>
      {children}
    </div>
  )
}

export function SuccessBanner({ children }) {
  return (
    <div style={{
      background: 'var(--green-dim)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      color: 'var(--green)',
      fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function btnStyle(disabled) {
  return {
    background: disabled ? 'rgba(108,99,255,0.4)' : 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: 4,
    transition: 'opacity 0.2s',
  }
}
