const path = require('path')
const fs = require('fs')
const Job = require('../models/Job')
const Number = require('../models/Number')
const { verificationQueue } = require('../queue/queue')
const { normalizeAndDedupe } = require('../utils/normalizePhone')
const txtExtractor = require('../services/txtExtractor')
const pdfExtractor = require('../services/pdfExtractor')
const { generatePdf } = require('../services/pdfGenerator')

async function handleUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' })

  const filePath = req.file.path
  const ext = path.extname(req.file.originalname).toLowerCase()

  let lines = []
  try {
    if (ext === '.pdf') {
      lines = await pdfExtractor.extractLines(filePath)
    } else {
      lines = txtExtractor.extractLines(filePath)
    }
  } catch (err) {
    return res.status(422).json({ message: 'Could not parse file: ' + err.message })
  } finally {
    // clean up uploaded file after extraction
    fs.unlink(filePath, () => {})
  }

  const phones = normalizeAndDedupe(lines)
  if (phones.length === 0) {
    return res.status(422).json({ message: 'No valid US phone numbers found in file.' })
  }

  // Create job document
  const job = await Job.create({ total: phones.length })

  // Bulk-insert Number docs (pending)
  const numberDocs = phones.map(p => ({ jobId: job._id, phone: p, valid: null }))
  await Number.insertMany(numberDocs)

  // Push each number into BullMQ
  const bulkJobs = phones.map(phone => ({
    name: 'verify',
    data: { phone, jobId: job._id.toString() },
  }))
  await verificationQueue.addBulk(bulkJobs)

  res.json({ jobId: job._id, total: phones.length })
}

async function getJobStatus(req, res) {
  const job = await Job.findById(req.params.jobId).lean()
  if (!job) return res.status(404).json({ message: 'Job not found.' })
  // Prevent 304 caching — browser must always get fresh data while job is running
  res.set('Cache-Control', 'no-store')
  res.json({
    total: job.total,
    completed: job.completed,
    valid: job.valid,
    invalid: job.invalid,
    status: job.status,
  })
}

async function downloadResults(req, res) {
  const { jobId } = req.params
  const format = (req.query.format || 'txt').toLowerCase()

  const job = await Job.findById(jobId).lean()
  if (!job) return res.status(404).json({ message: 'Job not found.' })
  if (job.status !== 'done') return res.status(400).json({ message: 'Job not finished yet.' })

  const numbers = await Number.find({ jobId, valid: true }).lean()
  const phones = numbers.map(n => n.phone)

  if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="valid_${jobId}.txt"`)
    return res.send(phones.join('\n'))
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="valid_${jobId}.csv"`)
    return res.send('phone\n' + phones.join('\n'))
  }

  if (format === 'pdf') {
    const pdfBytes = await generatePdf(phones)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="valid_${jobId}.pdf"`)
    return res.send(Buffer.from(pdfBytes))
  }

  res.status(400).json({ message: 'Invalid format. Use txt, csv, or pdf.' })
}

module.exports = { handleUpload, getJobStatus, downloadResults }
