const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { notifyAdminNewSignup, notifyUserApproved, notifyUserRejected } = require('../services/mailer')

const router = express.Router()

// ── Sign Up ──────────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const user = await User.create({ name, email, password })

    // Fire-and-forget — don't block signup if email fails
    notifyAdminNewSignup({ name, email, userId: user._id }).catch(err =>
      console.error('Admin notification email failed:', err.message)
    )

    res.status(201).json({
      message: 'Account created. You will receive an email once your access is approved.',
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Server error during signup' })
  }
})

// ── Log In ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const match = await user.comparePassword(password)
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is awaiting admin approval.' })
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your access request was not approved.' })
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error during login' })
  }
})

// ── Admin: Approve user (one-click link from email) ──────────────────────────
router.get('/approve/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    )
    if (!user) return res.status(404).send('User not found')

    notifyUserApproved({ name: user.name, email: user.email }).catch(err =>
      console.error('Approval email failed:', err.message)
    )

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#e2e2f0">
        <h2 style="color:#22c55e">✅ Approved!</h2>
        <p>${user.name} (${user.email}) has been approved and notified.</p>
      </body></html>
    `)
  } catch (err) {
    console.error('Approve error:', err)
    res.status(500).send('Server error')
  }
})

// ── Admin: Reject user (one-click link from email) ───────────────────────────
router.get('/reject/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    )
    if (!user) return res.status(404).send('User not found')

    notifyUserRejected({ name: user.name, email: user.email }).catch(err =>
      console.error('Rejection email failed:', err.message)
    )

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#e2e2f0">
        <h2 style="color:#ef4444">❌ Rejected</h2>
        <p>${user.name} (${user.email}) has been rejected and notified.</p>
      </body></html>
    `)
  } catch (err) {
    console.error('Reject error:', err)
    res.status(500).send('Server error')
  }
})

module.exports = router
