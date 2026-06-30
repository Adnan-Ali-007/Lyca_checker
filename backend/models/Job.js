const mongoose = require('mongoose')

const jobSchema = new mongoose.Schema({
  status: { type: String, default: 'processing' }, // processing | done
  total:  { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  valid:  { type: Number, default: 0 },
  invalid: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Job', jobSchema)
