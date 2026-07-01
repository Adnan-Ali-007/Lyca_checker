const jwt = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Middleware — verifies JWT token and attaches user to req.user.
 * Only approved users can pass.
 */
async function requireAuth(req, res, next) {
  // Accept token from Authorization header OR query param (for file downloads via window.open)
  let token = null
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7)
  } else if (req.query.token) {
    token = req.query.token
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.id).select('-password')
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account not yet approved' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
