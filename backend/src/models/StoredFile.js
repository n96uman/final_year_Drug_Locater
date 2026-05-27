const mongoose = require('mongoose')

const schema = new mongoose.Schema(
  {
    path: { type: String, required: true, unique: true, index: true },
    mimeType: { type: String, default: 'image/jpeg' },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('StoredFile', schema)
