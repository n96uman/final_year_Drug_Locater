const mongoose = require('mongoose')

/**
 * Recorded when a pharmacy adds a medicine whose name matches a previously
 * expired medicine from the same pharmacy. Flags it for admin review.
 */
const schema = new mongoose.Schema(
  {
    pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pharmacyName: { type: String, default: '' },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: { type: String, default: '' },
    newExpiry: { type: String, default: '' },
    previousExpiry: { type: String, default: '' },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ExpiredAlert', schema)
