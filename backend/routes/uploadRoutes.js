const express = require('express')
const multer = require('multer')
const path = require('path')
const { handleUpload, getJobStatus, downloadResults } = require('../controllers/uploadController')

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.pdf']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true)
    } else {
      cb(new Error('Only .txt and .pdf files are allowed.'))
    }
  },
})

const router = express.Router()
router.post('/upload', upload.single('file'), handleUpload)
router.get('/job/:jobId', getJobStatus)
router.get('/download/:jobId', downloadResults)

module.exports = router
