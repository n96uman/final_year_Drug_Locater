const Medicine = require('../models/Medicine')
const User = require('../models/User')
const ExpiredAlert = require('../models/ExpiredAlert')

const today = () => new Date().toISOString().slice(0, 10)

exports.getMedicines = async (_req, res) => {
  const approvedOwners = await User.find({
    role: 'pharmacy',
    $or: [{ pharmacyApprovalStatus: 'approved' }, { pharmacyApprovalStatus: { $exists: false } }],
  }).distinct('_id')

  // Exclude expired medicines from the public listing entirely
  const medicines = await Medicine.find({
    createdBy: { $in: approvedOwners },
    $or: [
      { expiry: { $exists: false } },
      { expiry: '' },
      { expiry: null },
      { expiry: { $gte: today() } },
    ],
  })
    .populate('createdBy', 'location locationLat locationLng accountNumber')
    .sort({ createdAt: -1 })

  res.json({
    medicines: medicines.map((m) => {
      const obj = m.toObject()
      return {
        ...obj,
        createdBy: obj.createdBy?._id || obj.createdBy,
        pharmacyLocation: obj.createdBy?.location || '',
        pharmacyLat: obj.createdBy?.locationLat ?? null,
        pharmacyLng: obj.createdBy?.locationLng ?? null,
        pharmacyAccountNumber: obj.createdBy?.accountNumber || '',
      }
    }),
  })
}

exports.getMine = async (req, res) =>
  res.json({ medicines: await Medicine.find({ createdBy: req.user._id }).sort({ createdAt: -1 }) })

exports.create = async (req, res) => {
  const m = await Medicine.create({ ...req.body, createdBy: req.user._id })

  // Check if this pharmacy previously had an expired medicine with the same name
  // (case-insensitive, trimmed). If so, create an ExpiredAlert for admin review.
  if (m.name) {
    const nameRegex = new RegExp(`^${m.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    const previousExpired = await Medicine.findOne({
      _id: { $ne: m._id },
      createdBy: req.user._id,
      name: nameRegex,
      expiry: { $lt: today() },
    }).sort({ expiry: -1 })

    if (previousExpired) {
      await ExpiredAlert.create({
        pharmacy: req.user._id,
        pharmacyName: req.user.name || '',
        medicine: m._id,
        medicineName: m.name,
        newExpiry: m.expiry || '',
        previousExpiry: previousExpired.expiry || '',
        reviewed: false,
      })
    }
  }

  res.status(201).json({ medicine: m })
}

exports.update = async (req, res) => {
  const m = await Medicine.findById(req.params.id)
  if (!m) return res.status(404).json({ message: 'Not found' })
  if (String(m.createdBy) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' })
  Object.assign(m, req.body)
  await m.save()
  res.json({ medicine: m })
}

exports.remove = async (req, res) => {
  const m = await Medicine.findById(req.params.id)
  if (!m) return res.status(404).json({ message: 'Not found' })
  if (String(m.createdBy) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' })
  await m.deleteOne()
  res.json({ message: 'Deleted' })
}
