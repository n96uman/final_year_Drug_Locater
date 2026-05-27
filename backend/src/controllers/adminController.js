const fs = require('fs')
const path = require('path')
const User = require('../models/User')
const Medicine = require('../models/Medicine')
const Order = require('../models/Order')
const Transaction = require('../models/Transaction')
const ExpiredAlert = require('../models/ExpiredAlert')
const { filePublicUrl } = require('../utils/publicFileUrl')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')
const { getUploadRoot } = require('../utils/uploadPaths')
const { readStoredUpload } = require('../utils/storedFiles')

const img = (req, p) => filePublicUrl(req, sanitizeUploadPath(p))

const UPLOAD_ROOT = getUploadRoot()

function mapPharmacy(req, u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    profileImage: img(req, u.profileImage),
    hasLicense: Boolean(u.licenseImage),
    location: u.location || '',
    accountNumber: u.accountNumber || '',
    pharmacyApprovalStatus: u.pharmacyApprovalStatus,
  }
}

exports.getStats = async (_req, res) => {
  const now = new Date()
  const [pendingPharmacies, approvedPharmacies, rejectedPharmacies, customers, medicines, orders, expiredMedicines] =
    await Promise.all([
      User.countDocuments({ role: 'pharmacy', pharmacyApprovalStatus: 'pending' }),
      User.countDocuments({ role: 'pharmacy', pharmacyApprovalStatus: 'approved' }),
      User.countDocuments({ role: 'pharmacy', pharmacyApprovalStatus: 'rejected' }),
      User.countDocuments({ role: 'customer' }),
      Medicine.countDocuments(),
      Order.countDocuments(),
      Medicine.countDocuments({ expiry: { $lt: now.toISOString().slice(0, 10) } }),
    ])
  res.json({
    stats: { pendingPharmacies, approvedPharmacies, rejectedPharmacies, customers, medicines, orders, expiredMedicines },
  })
}

exports.listPharmacies = async (req, res) => {
  const status = String(req.query.status || 'pending').toLowerCase()
  const filter = { role: 'pharmacy' }
  if (status !== 'all') {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status filter' })
    }
    filter.pharmacyApprovalStatus = status
  }
  const list = await User.find(filter)
    .select('name email profileImage licenseImage location accountNumber createdAt pharmacyApprovalStatus')
    .sort({ createdAt: -1 })
    .lean()
  res.json({ pharmacies: list.map((u) => mapPharmacy(req, u)) })
}

exports.listPendingPharmacies = async (req, res) => {
  req.query.status = 'pending'
  return exports.listPharmacies(req, res)
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

// All transactions across all pharmacies
exports.listAllTransactions = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const transactions = await Transaction.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('pharmacy', 'name email')
    .populate('customer', 'name email')
    .populate('order', 'status paymentMethod total createdAt')
    .lean()
  res.json({ transactions })
}

// Pharmacies that have an accountNumber set
exports.listPharmaciesWithAccounts = async (req, res) => {
  const list = await User.find({
    role: 'pharmacy',
    pharmacyApprovalStatus: 'approved',
    accountNumber: { $exists: true, $ne: '' },
  })
    .select('name email location accountNumber createdAt')
    .sort({ name: 1 })
    .lean()
  res.json({ pharmacies: list.map((u) => ({ id: u._id, name: u.name, email: u.email, location: u.location || '', accountNumber: u.accountNumber || '', createdAt: u.createdAt })) })
}

// Orders that contained expired medicines at checkout time
exports.listExpiredDrugAlerts = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10)

  // 1. Re-add alerts — pharmacy added a medicine with same name as a previously expired one
  const reAddAlerts = await ExpiredAlert.find({ reviewed: false })
    .sort({ createdAt: -1 })
    .populate('pharmacy', 'name email')
    .populate('medicine', 'name expiry quantity pharmacyName')
    .lean()

  // 2. Orders that contained medicines that are now expired
  const expiredMeds = await Medicine.find({ expiry: { $lt: today } }).select('_id name expiry pharmacyName').lean()
  const expiredIds = expiredMeds.map((m) => m._id)
  const expiredMap = Object.fromEntries(expiredMeds.map((m) => [String(m._id), m]))

  let orderAlerts = []
  if (expiredIds.length) {
    const orders = await Order.find({ 'items.medicineId': { $in: expiredIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('customer', 'name email')
      .lean()

    orderAlerts = orders.map((o) => {
      const expiredItems = o.items.filter((i) => expiredMap[String(i.medicineId)])
      return {
        orderId: o._id,
        orderStatus: o.status,
        createdAt: o.createdAt,
        customer: o.customer ? { name: o.customer.name, email: o.customer.email } : null,
        expiredItems: expiredItems.map((i) => ({
          medicineName: i.medicineName,
          pharmacyName: i.pharmacyName,
          quantity: i.quantity,
          expiry: expiredMap[String(i.medicineId)]?.expiry || '',
        })),
      }
    })
  }

  res.json({ alerts: orderAlerts, reAddAlerts })
}

// Mark a re-add alert as reviewed (dismiss it)
exports.dismissExpiredAlert = async (req, res) => {
  const alert = await ExpiredAlert.findById(req.params.id)
  if (!alert) return res.status(404).json({ message: 'Alert not found' })
  alert.reviewed = true
  await alert.save()
  res.json({ message: 'Alert dismissed.' })
}

// Currently expired medicines (for admin dashboard warning)
exports.listExpiredMedicines = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const list = await Medicine.find({ expiry: { $lt: today } })
    .populate('createdBy', 'name email')
    .sort({ expiry: 1 })
    .lean()
  res.json({
    medicines: list.map((m) => ({
      id: m._id,
      name: m.name,
      genericName: m.genericName,
      pharmacyName: m.pharmacyName,
      pharmacyEmail: m.createdBy?.email || '',
      quantity: m.quantity,
      expiry: m.expiry,
    })),
  })
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
  const stored = await readStoredUpload(rel)
  if (!stored) return res.status(404).json({ message: 'File not found' })
  res.setHeader('Content-Type', stored.mimeType)
  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.send(stored.data)
}
