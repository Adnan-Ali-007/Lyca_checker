require('dotenv').config()

// Patch ioredis BEFORE bullmq loads so every internal connection it creates
// also has the error handler. BullMQ v5 creates its own IORedis instances
// which bypass any wrapper we make — patching the prototype fixes all of them.
const IORedis = require('ioredis')
const SUPPRESS = new Set(['ECONNRESET', 'ECONNABORTED', 'EPIPE'])
const _redisEmit = IORedis.prototype.emit
IORedis.prototype.emit = function (event, err, ...rest) {
  if (event === 'error' && err && SUPPRESS.has(err.code)) return false
  return _redisEmit.call(this, event, err, ...rest)
}

const path = require('path')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const uploadRoutes = require('./routes/uploadRoutes')
const authRoutes = require('./routes/authRoutes')
const { requireAuth } = require('./middleware/auth')
const { startWorkers } = require('./workers/verificationWorker')
const { verificationQueue } = require('./queue/queue')

const PORT = process.env.PORT || 4000

const app = express()
app.use(cors())
app.use(express.json())

// Public auth routes (signup / login / approve / reject links)
app.use('/api/auth', authRoutes)

// Protected routes — valid JWT + approved status required
app.use('/api', requireAuth, uploadRoutes)

// Serve built React frontend (production — Docker copies dist here)
const publicDir = path.join(__dirname, 'public')
app.use(express.static(publicDir))
// SPA fallback — any unknown route returns index.html so React Router works
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found')
  })
})

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected')

    // Drain leftover jobs from any previous crashed session so they don't
    // get re-processed or loop. This wipes waiting + delayed + prioritized.
    await verificationQueue.drain()
    console.log('Queue drained — clean start')

    startWorkers()
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`)
    })
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
