const mongoose = require('mongoose')

const numberSchema = new mongoose.Schema({
  jobId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true },
  phone:  { type: String },
  valid:  { type: Boolean, default: null }, // null = pending
})

module.exports = mongoose.model('Number', numberSchema)
