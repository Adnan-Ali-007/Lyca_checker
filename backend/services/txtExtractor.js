const fs = require('fs')

/**
 * Read a .txt file and return an array of raw lines.
 */
function extractLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  return content.split(/\r?\n/).filter(l => l.trim())
}

module.exports = { extractLines }
