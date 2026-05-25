const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { jwtSecret } = require('../config/auth')
const { isStrongPassword, strongPasswordMessage } = require('../utils/passwordPolicy')
const { filePublicUrl } = require('../utils/publicFileUrl')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')

const img = (req, p) => filePublicUrl(req, sanitizeUploadPath(p))

const UPLOAD_ROOT = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads')

function tryUnlinkUpload(rel) {
  if (!rel || typeof rel !== 'string' || !rel.startsWith('/uploads/')) return
  const clean = sanitizeUploadPath(rel)
  if (!clean || !clean.startsWith('/uploads/')) return
  const basename = path.basename(clean)
  if (!/^(license|profile)-\d+\.(jpe?g|png|gif|webp|jfif)$/i.test(basename)) return
  const abs = path.resolve(UPLOAD_ROOT, basename)
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) return
  try {
    fs.unlinkSync(abs)
  } catch {
    /* ignore */
  }
}
const safe = (u, req) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  profileImage: img(req, u.profileImage),
  pharmacyApprovalStatus: u.pharmacyApprovalStatus || 'approved',
  location: u.location || '',
  locationLat: u.locationLat ?? null,
  locationLng: u.locationLng ?? null,
  termsAccepted: Boolean(u.termsAcceptedAt),
  ...(u.role === 'pharmacy' ? { hasLicense: Boolean(u.licenseImage) } : {}),
})

function parseAcceptTerms(body) {
  const v = body?.acceptTerms
  return v === true || v === 'true' || v === '1'
}

async function ensureTermsAccepted(user, body) {
  if (user.termsAcceptedAt) return null
  if (!parseAcceptTerms(body)) {
    return { status: 403, message: 'You must accept the terms and conditions to continue.', code: 'TERMS_REQUIRED' }
  }
  user.termsAcceptedAt = new Date()
  await user.save()
  return null
}

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body
  const files = req.files || {}
  const profileFile = files.profileImage?.[0]
  const licenseFile = files.licenseImage?.[0]
  if (!name || !email || !password || !role) return res.status(400).json({ message: 'All fields required' })
  if (!parseAcceptTerms(req.body)) return res.status(400).json({ message: 'You must accept the terms and conditions.' })
  if (role === 'admin') return res.status(403).json({ message: 'Invalid role' })
  const em = String(email).toLowerCase().trim()
  if (em === 'admin') return res.status(400).json({ message: 'This email is reserved' })

  if (!isStrongPassword(password)) return res.status(400).json({ message: strongPasswordMessage })

  if (role === 'pharmacy') {
    if (!licenseFile) return res.status(400).json({ message: 'Pharmacy license image is required' })
  }

  const existing = await User.findOne({ email: em })
  if (existing) {
    const isRejectedPharmacy =
      existing.role === 'pharmacy' && existing.pharmacyApprovalStatus === 'rejected'
    if (isRejectedPharmacy) {
      tryUnlinkUpload(existing.licenseImage)
      tryUnlinkUpload(existing.profileImage)
      await User.deleteOne({ _id: existing._id })
    } else {
      return res.status(409).json({ message: 'Email already exists' })
    }
  }

  const profilePath = profileFile ? sanitizeUploadPath(`/uploads/${profileFile.filename}`) : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
  const licensePath = licenseFile ? sanitizeUploadPath(`/uploads/${licenseFile.filename}`) : undefined

  const user = await User.create({
    name,
    email: em,
    password: await bcrypt.hash(password, 10),
    role,
    profileImage: profilePath,
    licenseImage: licensePath,
    pharmacyApprovalStatus: role === 'pharmacy' ? 'pending' : 'approved',
    termsAcceptedAt: new Date(),
  })
  const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '7d' })
  res.status(201).json({ token, user: safe(user, req) })
}

exports.login = async (req, res) => {
  const { email, password } = req.body
  const em = String(email || '').toLowerCase().trim()
  const user = await User.findOne({ email: em })
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials' })
  const termsErr = await ensureTermsAccepted(user, req.body)
  if (termsErr) return res.status(termsErr.status).json({ message: termsErr.message, code: termsErr.code })
  const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '7d' })
  res.json({ token, user: safe(user, req) })
}

exports.abandonPendingPharmacyAccount = async (req, res) => {
  const u = req.user
  if (u.role !== 'pharmacy' || u.pharmacyApprovalStatus !== 'pending') {
    return res.status(400).json({ message: 'No pending pharmacy registration to withdraw.' })
  }
  tryUnlinkUpload(u.licenseImage)
  tryUnlinkUpload(u.profileImage)
  await User.deleteOne({ _id: u._id })
  res.json({ message: 'Registration withdrawn.' })
}

exports.me = async (req, res) => res.json({ user: safe(req.user, req) })
exports.updateProfile = async (req, res) => {
  if (req.body.name != null) req.user.name = String(req.body.name).trim().slice(0, 120)
  if (req.file) req.user.profileImage = sanitizeUploadPath(`/uploads/${req.file.filename}`)
  if (req.user.role === 'pharmacy' && req.body.location != null) {
    req.user.location = String(req.body.location).trim().slice(0, 500)
    const lat = Number(req.body.locationLat)
    const lng = Number(req.body.locationLng)
    req.user.locationLat = Number.isFinite(lat) ? lat : null
    req.user.locationLng = Number.isFinite(lng) ? lng : null
  }
  await req.user.save()
  res.json({ user: safe(req.user, req) })
}

exports.updatePharmacyLicense = async (req, res) => {
  if (req.user.role !== 'pharmacy') return res.status(403).json({ message: 'Pharmacy account required' })
  if (!req.file) return res.status(400).json({ message: 'Licence image is required' })
  tryUnlinkUpload(req.user.licenseImage)
  req.user.licenseImage = sanitizeUploadPath(`/uploads/${req.file.filename}`)
  if (req.user.pharmacyApprovalStatus === 'approved') req.user.pharmacyApprovalStatus = 'pending'
  await req.user.save()
  res.json({
    user: safe(req.user, req),
    message: 'Licence photo updated. Your account is pending admin review again.',
  })
}
