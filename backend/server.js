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

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const uploadRoutes = require('./routes/uploadRoutes')
const { startWorkers } = require('./workers/verificationWorker')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', uploadRoutes)

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected')
    startWorkers()
    app.listen(process.env.PORT, () => {
      console.log(`Backend running on port ${process.env.PORT}`)
    })
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
