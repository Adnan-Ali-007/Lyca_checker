const pdfParse = require('pdf-parse')
const fs = require('fs')

/**
 * Extract raw lines from a PDF file.
 */
async function extractLines(filePath) {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return data.text.split(/\r?\n/).filter(l => l.trim())
}

module.exports = { extractLines }
