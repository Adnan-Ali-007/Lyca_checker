import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { AuthLayout, Field, ErrorBanner, SuccessBanner } from './LoginPage'

const API = import.meta.env.VITE_API_URL || ''

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      return setError('Passwords do not match')
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters')
    }

    setLoading(true)
    try {
      await axios.post(`${API}/api/auth/signup`, {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout title="Request sent!" subtitle="Your access request is under review">
        <SuccessBanner>
          Your account has been created. The administrator will review your request and
          email you once you've been approved. You can then log in.
        </SuccessBanner>
        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 14 }}>
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Back to login
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Request access" subtitle="Create an account — admin approval required">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Your name" />
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 8 characters" />
        <Field label="Confirm password" name="confirm" type="password" value={form.confirm} onChange={handleChange} placeholder="••••••••" />

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? 'rgba(108,99,255,0.4)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {loading ? 'Submitting…' : 'Request Access'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 14 }}>
        Already approved?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
