const { normalizeAndDedupe } = require('./utils/normalizePhone')
const { extractLines } = require('./services/txtExtractor')
const fs = require('fs')

// Simulate the exact file content from the user
const content = `3472616097347582910662817439509153078462402689153778624590185598301746214975608368134275903476031984973518204630586472914172936850832150974664672938155083614927347286463334749320507198452630267930514895418273603856712409`

fs.writeFileSync('./test_real.txt', content)
const lines = extractLines('./test_real.txt')
const phones = normalizeAndDedupe(lines)
console.log('Extracted phones:', phones)
console.log('Count:', phones.length)
fs.unlinkSync('./test_real.txt')
