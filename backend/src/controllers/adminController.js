const User = require('../models/User')

const img = (req, p) => (p?.startsWith('http') ? p : `${req.protocol}://${req.get('host')}${p || ''}`)

exports.listPendingPharmacies = async (req, res) => {
  const list = await User.find({ role: 'pharmacy', pharmacyApprovalStatus: 'pending' })
    .select('name email profileImage licenseImage createdAt pharmacyApprovalStatus')
    .sort({ createdAt: -1 })
    .lean()
  res.json({
    pharmacies: list.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      profileImage: img(req, u.profileImage),
      licenseImage: u.licenseImage ? img(req, u.licenseImage) : null,
      pharmacyApprovalStatus: u.pharmacyApprovalStatus,
    })),
  })
}

exports.approvePharmacy = async (req, res) => {
  const u = await User.findById(req.params.id)
  if (!u || u.role !== 'pharmacy') return res.status(404).json({ message: 'Pharmacy not found' })
  u.pharmacyApprovalStatus = 'approved'
  await u.save()
  res.json({ message: 'Pharmacy approved.', id: u._id })
}

exports.rejectPharmacy = async (req, res) => {
  const u = await User.findById(req.params.id)
  if (!u || u.role !== 'pharmacy') return res.status(404).json({ message: 'Pharmacy not found' })
  u.pharmacyApprovalStatus = 'rejected'
  await u.save()
  res.json({ message: 'Pharmacy registration rejected.', id: u._id })
}
