const mongoose = require('mongoose')
const schema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['customer', 'pharmacy', 'admin'] },
    profileImage: String,
    licenseImage: String,
    pharmacyApprovalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
  },
  { timestamps: true }
)
module.exports = mongoose.model('User', schema)
