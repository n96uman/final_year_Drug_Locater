const fs = require('fs')
const path = require('path')
const User = require('../models/User')
const { filePublicUrl } = require('../utils/publicFileUrl')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')

const img = (req, p) => filePublicUrl(req, sanitizeUploadPath(p))

const UPLOAD_ROOT = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads')

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

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jfif': 'image/jfif',
}

exports.servePharmacyLicense = async (req, res) => {
  const u = await User.findById(req.params.id)
  if (!u || u.role !== 'pharmacy') return res.status(404).json({ message: 'Not found' })
  const rel = sanitizeUploadPath(u.licenseImage)
  if (!rel || !rel.startsWith('/uploads/')) return res.status(404).json({ message: 'No licence on file' })
  const basename = path.basename(rel)
  if (!/^(license|profile)-\d+\.(jpe?g|png|gif|webp|jfif)$/i.test(basename)) {
    return res.status(404).json({ message: 'Invalid path' })
  }
  const abs = path.resolve(UPLOAD_ROOT, basename)
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) return res.status(404).json({ message: 'Invalid path' })
  if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' })
  const ext = path.extname(abs).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.sendFile(abs)
}
