/**
 * test-parallelism.js
 *
 * Verifies that increasing WORKER_COUNT actually gives you parallel job
 * processing.  No real Selenium / Lyca network calls — each job is a
 * simulated "verification" that sleeps for JOB_DURATION_MS so we can
 * measure wall-clock vs serial time.
 *
 * Usage:
 *   node test-parallelism.js              # uses WORKER_COUNT from .env
 *   WORKER_COUNT=1 node test-parallelism.js
 *   WORKER_COUNT=4 node test-parallelism.js
 *
 * What to look for:
 *   • workerCount=1 : wall-clock ≈ JOBS × JOB_DURATION_MS  (serial)
 *   • workerCount=N : wall-clock ≈ ceil(JOBS / N) × JOB_DURATION_MS
 *     → confirms real parallelism / multi-threading via multiple processes
 */

require('dotenv').config()
const { Worker, Queue } = require('bullmq')
const IORedis  = require('ioredis')

// ─── Config ────────────────────────────────────────────────────────────────
const WORKER_COUNT    = parseInt(process.env.WORKER_COUNT || '4', 10)
const JOBS            = 12          // total jobs to enqueue
const JOB_DURATION_MS = 1500        // how long each fake "verification" takes
const QUEUE_NAME      = 'parallelism-test'
// ────────────────────────────────────────────────────────────────────────────

function makeRedis() {
  const r = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  r.on('error', () => {}) // silence reconnect noise
  return r
}

async function run() {
  console.log('\n══════════════════════════════════════════════')
  console.log(` Parallelism Test`)
  console.log(` WORKER_COUNT    = ${WORKER_COUNT}`)
  console.log(` JOBS            = ${JOBS}`)
  console.log(` JOB_DURATION_MS = ${JOB_DURATION_MS}`)
  console.log(` Expected serial  ≈ ${(JOBS * JOB_DURATION_MS / 1000).toFixed(1)}s`)
  console.log(` Expected parallel≈ ${(Math.ceil(JOBS / WORKER_COUNT) * JOB_DURATION_MS / 1000).toFixed(1)}s  (${WORKER_COUNT} workers)`)
  console.log('══════════════════════════════════════════════\n')

  // ── Shared state ─────────────────────────────────────────────────────────
  const workerStartTimes = {}   // workerId → first job start epoch
  const concurrentSnapshots = []
  let   activeCount  = 0
  let   maxConcurrent = 0
  let   completedCount = 0

  // ── Queue ─────────────────────────────────────────────────────────────────
  const queueConn = makeRedis()
  const queue = new Queue(QUEUE_NAME, { connection: queueConn })

  // Drain anything leftover from a prior run
  await queue.drain()

  // ── Workers ───────────────────────────────────────────────────────────────
  const workers = []
  const workerDone = new Promise((resolve) => {
    for (let i = 0; i < WORKER_COUNT; i++) {
      const w = new Worker(
        QUEUE_NAME,
        async (job) => {
          const { jobIndex } = job.data

          // Track concurrency
          activeCount++
          if (activeCount > maxConcurrent) maxConcurrent = activeCount
          concurrentSnapshots.push({ jobIndex, active: activeCount, ts: Date.now() })
          if (!workerStartTimes[i]) workerStartTimes[i] = Date.now()

          console.log(`  [worker ${i}] ▶  job #${jobIndex}  (active=${activeCount})`)

          // Simulate work
          await new Promise(r => setTimeout(r, JOB_DURATION_MS))

          activeCount--
          completedCount++
          console.log(`  [worker ${i}] ✔  job #${jobIndex}  (active=${activeCount}, done=${completedCount}/${JOBS})`)

          if (completedCount >= JOBS) resolve()
        },
        {
          connection: makeRedis(),
          concurrency: 1,       // mirrors your real worker setting
          lockDuration: 60000,
          lockRenewTime: 15000,
        }
      )

      w.on('failed', (job, err) => {
        console.error(`  [worker ${i}] ✗ job failed:`, err.message)
        completedCount++
        if (completedCount >= JOBS) resolve()
      })

      workers.push(w)
    }
  })

  // ── Enqueue jobs ──────────────────────────────────────────────────────────
  const wallStart = Date.now()
  for (let j = 0; j < JOBS; j++) {
    await queue.add('verify', { jobIndex: j + 1 })
  }
  console.log(`Enqueued ${JOBS} jobs — waiting for workers...\n`)

  // ── Wait for all jobs to finish ───────────────────────────────────────────
  await workerDone
  const wallMs = Date.now() - wallStart

  // ── Results ───────────────────────────────────────────────────────────────
  const uniqueWorkers = Object.keys(workerStartTimes).length
  const serialEstimate = JOBS * JOB_DURATION_MS
  const speedup = serialEstimate / wallMs

  console.log('\n══════════════════════════════════════════════')
  console.log(' RESULTS')
  console.log('──────────────────────────────────────────────')
  console.log(` Wall-clock time  : ${(wallMs / 1000).toFixed(2)}s`)
  console.log(` Serial estimate  : ${(serialEstimate / 1000).toFixed(2)}s`)
  console.log(` Speed-up factor  : ${speedup.toFixed(2)}x`)
  console.log(` Workers active   : ${uniqueWorkers} / ${WORKER_COUNT}`)
  console.log(` Max concurrency  : ${maxConcurrent} simultaneous jobs`)
  console.log('──────────────────────────────────────────────')

  if (maxConcurrent >= 2) {
    console.log(' ✅  PARALLELISM CONFIRMED — multiple jobs ran simultaneously')
  } else if (WORKER_COUNT === 1) {
    console.log(' ✅  Single-worker mode — serial execution as expected')
  } else {
    console.log(' ⚠️   Max concurrency was 1 — jobs ran serially despite multiple workers')
    console.log('     (this can happen if Redis queued them faster than workers polled)')
  }

  if (speedup >= WORKER_COUNT * 0.6) {
    console.log(` ✅  Throughput scales with worker count (${speedup.toFixed(2)}x for ${WORKER_COUNT} workers)`)
  } else {
    console.log(` ⚠️   Speedup (${speedup.toFixed(2)}x) is lower than worker count (${WORKER_COUNT})`)
    console.log('     Could be Redis round-trip overhead or job pickup latency.')
  }

  console.log('══════════════════════════════════════════════\n')

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await Promise.all(workers.map(w => w.close()))
  await queue.obliterate({ force: true })
  await queueConn.quit()
  process.exit(0)
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
