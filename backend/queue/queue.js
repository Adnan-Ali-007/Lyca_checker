const { Queue } = require('bullmq')
const IORedis = require('ioredis')

const REDIS_OPTS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Keep connections alive so Docker doesn't silently drop them
  keepAlive: 10000,
  // Reconnect quickly on drop instead of hammering with writes
  retryStrategy: (times) => Math.min(times * 50, 2000),
}

function makeRedis() {
  const r = new IORedis(process.env.REDIS_URL, REDIS_OPTS)
  r.on('error', () => {}) // silence all — ioredis reconnects automatically
  return r
}

const connection = makeRedis()
const verificationQueue = new Queue('verification', { connection })

module.exports = { verificationQueue, connection, makeRedis }
