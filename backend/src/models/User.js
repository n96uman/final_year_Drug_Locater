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
    location: { type: String, default: '' },
    locationLat: { type: Number, default: null },
    locationLng: { type: Number, default: null },
    termsAcceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
)
module.exports = mongoose.model('User', schema)
