const Order = require('../models/Order')
const Medicine = require('../models/Medicine')
const Transaction = require('../models/Transaction')
const { filePublicUrl } = require('../utils/publicFileUrl')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')

const recalc = (items) => {
  const statuses = items.map((i) => i.status)
  if (statuses.every((x) => x === 'approved')) return 'approved'
  if (statuses.every((x) => x === 'rejected')) return 'rejected'
  if (statuses.some((x) => x === 'approved')) return 'partially_approved'
  return 'pending'
}
const belongs = (item, id, name) => (item.pharmacyId && String(item.pharmacyId) === String(id)) || item.pharmacyName === name
const img = (req, p) => filePublicUrl(req, sanitizeUploadPath(p))
const bodyJson = (value, fallback) => {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}
const weekFilter = (period) => {
  if (period !== 'week') return {}
  const startOfWeek = new Date()
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  return { createdAt: { $gte: startOfWeek } }
}

const createPharmacyTransactions = async (order) => {
  const byPharmacy = new Map()
  for (const item of order.items) {
    const key = String(item.pharmacyId || item.pharmacyName)
    const current = byPharmacy.get(key) || {
      order: order._id,
      customer: order.customer,
      pharmacy: item.pharmacyId,
      amount: 0,
      status: 'pending',
      type: 'chapa',
    }
    current.amount += Number(item.price) * Number(item.quantity)
    byPharmacy.set(key, current)
  }
  if (byPharmacy.size) await Transaction.insertMany([...byPharmacy.values()])
}

const updateOrderTransactions = async (order) => {
  if (order.paymentMethod !== 'chapa') return
  if (order.status === 'approved') {
    await Transaction.updateMany({ order: order._id }, { status: 'completed', updatedAt: new Date() })
  } else if (order.status === 'rejected') {
    await Transaction.updateMany({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
  }
}

exports.createOrder = async (req, res) => {
  const files = req.files || {}
  const receiptFile = files.receiptImage?.[0]
  const prescriptionFile = files.prescriptionImage?.[0] || files.prescriptionFile?.[0]
  const paymentMethod = req.body.paymentMethod === 'chapa' ? 'chapa' : 'none'
  const requestedItems = bodyJson(req.body.items, [])
  const receiptPath = receiptFile ? sanitizeUploadPath(`/uploads/${receiptFile.filename}`) : ''
  const prescriptionPath = prescriptionFile ? sanitizeUploadPath(`/uploads/${prescriptionFile.filename}`) : ''
  const chapaAccount = String(req.body.chapaAccount || '').trim()
  const chapaDemoPassword = String(req.body.chapaDemoPassword || '').trim()
  const wantsDelivery = req.body.wantsDelivery === true || req.body.wantsDelivery === 'true' || req.body.wantsDelivery === '1'

  if (paymentMethod !== 'chapa' && !receiptPath) return res.status(400).json({ message: 'Please upload a receipt photo before checkout.' })
  if (paymentMethod === 'chapa' && !chapaAccount) return res.status(400).json({ message: 'Enter a Chapa demo phone or account number.' })
  if (paymentMethod === 'chapa' && !chapaDemoPassword) return res.status(400).json({ message: 'Enter any demo password for the Chapa test screen. Do not use a real password.' })

  const final = []
  for (const raw of requestedItems || []) {
    const qty = Number(raw.quantity)
    const med = await Medicine.findById(raw.medicineId)
    if (!med) return res.status(404).json({ message: 'Medicine not found' })
    if (med.quantity < qty) return res.status(400).json({ message: `You cannot checkout ${qty} of ${med.name}. Only ${med.quantity} available.` })
    final.push({ medicineId: med._id, pharmacyId: med.createdBy, medicineName: med.name, pharmacyName: med.pharmacyName, price: Number(med.price), quantity: qty, status: 'pending' })
  }
  const subtotal = final.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = wantsDelivery && final.length ? 50 : 0
  const total = subtotal + delivery
  const order = await Order.create({
    customer: req.user._id,
    items: final,
    subtotal,
    delivery,
    total,
    wantsDelivery,
    status: 'pending',
    paymentMethod,
    paymentStatus: paymentMethod === 'chapa' ? 'paid' : 'pending',
    paymentReference: paymentMethod === 'chapa' ? `demo_chapa_${Date.now()}` : undefined,
    receiptImage: receiptPath,
    prescriptionImage: prescriptionPath,
    chapaAccount: paymentMethod === 'chapa' ? chapaAccount : undefined,
  })
  if (paymentMethod === 'chapa') {
    await createPharmacyTransactions(order)
    return res.status(201).json({ order, testPayment: true, message: 'Chapa demo payment accepted. Order is waiting for pharmacy approval.' })
  }
  res.status(201).json({ order, message: 'Order placed and waiting pharmacy approval.' })
}

exports.updateDeliveryLocation = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, customer: req.user._id })
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  if (!order.wantsDelivery) return res.status(400).json({ message: 'Delivery is not enabled for this order.' })
  if (!['approved', 'partially_approved'].includes(order.status)) {
    return res.status(409).json({ message: 'Delivery location can be set only after order approval.' })
  }

  const lat = Number(req.body.deliveryLocationLat)
  const lng = Number(req.body.deliveryLocationLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required.' })
  }

  order.deliveryLocationLat = lat
  order.deliveryLocationLng = lng
  await order.save()
  res.json({ message: 'Delivery location saved.', order })
}

exports.verifyChapaPayment = async (req, res) => {
  const { txRef } = req.body
  const order = txRef ? await Order.findOne({ paymentReference: txRef, customer: req.user._id }) : null
  if (order) return res.json({ status: 'paid', paymentStatus: order.paymentStatus, order, testPayment: true })
  res.json({ status: 'paid', paymentStatus: 'paid', testPayment: true, message: 'Chapa demo verification accepted.' })
}

exports.getMyOrders = async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 })
  res.json({
    orders: orders.map((order) => ({
      ...order.toObject(),
      receiptImage: img(req, order.receiptImage),
      prescriptionImage: img(req, order.prescriptionImage || order.prescription),
    })),
  })
}

exports.getPharmacyOrders = async (req, res) => {
  const id = req.user._id
  const orders = await Order.find({ status: { $ne: 'cancelled' }, $or: [{ 'items.pharmacyId': id }, { 'items.pharmacyName': req.user.name }] }).populate('customer', 'name email').sort({ createdAt: -1 })
  res.json({
    orders: orders.map((order) => ({
      id: order._id,
      customer: order.customer,
      createdAt: order.createdAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      wantsDelivery: Boolean(order.wantsDelivery),
      deliveryLocationLat: order.deliveryLocationLat ?? null,
      deliveryLocationLng: order.deliveryLocationLng ?? null,
      chapaAccount: order.chapaAccount,
      receiptImage: img(req, order.receiptImage),
      prescriptionImage: img(req, order.prescriptionImage || order.prescription),
      items: order.items.filter((item) => belongs(item, id, req.user.name)),
    })),
  })
}

exports.cancelCustomerOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, customer: req.user._id })
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  if (order.status !== 'pending' || order.items.some((item) => item.status === 'approved')) {
    return res.status(409).json({ message: 'This order cannot be cancelled after pharmacy approval.' })
  }
  order.status = 'cancelled'
  await order.save()
  if (order.paymentMethod === 'chapa') {
    await Transaction.updateMany({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
  }
  res.json({ message: order.paymentMethod === 'chapa' ? 'Order cancelled. Your Chapa demo payment has been returned.' : 'Order cancelled.', order })
}

exports.approvePharmacyOrder = async (req, res) => {
  const id = req.user._id
  const order = await Order.findById(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const list = order.items.filter((item) => belongs(item, id, req.user.name) && item.status === 'pending')
  if (!list.length) return res.status(400).json({ message: 'No pending items for this pharmacy in the selected order' })
  for (const item of list) {
    const med = await Medicine.findById(item.medicineId)
    if (!med || med.quantity < item.quantity) return res.status(400).json({ message: `Cannot approve ${item.medicineName}. Requested ${item.quantity}, available ${med ? med.quantity : 0}.` })
  }
  for (const item of list) {
    await Medicine.updateOne({ _id: item.medicineId, quantity: { $gte: item.quantity } }, { $inc: { quantity: -item.quantity } })
  }
  order.items = order.items.map((item) => belongs(item, id, req.user.name) && item.status === 'pending' ? { ...item.toObject(), status: 'approved', approvedAt: new Date() } : item)
  order.status = recalc(order.items)
  await order.save()
  if (order.paymentMethod === 'chapa') {
    await Transaction.updateMany({ order: order._id, pharmacy: id }, { status: 'completed', updatedAt: new Date() })
  }
  await updateOrderTransactions(order)
  res.json({ message: 'Order approved and stock updated.', order })
}

exports.rejectPharmacyOrder = async (req, res) => {
  const id = req.user._id
  const rejectionReason = String(req.body.rejectionReason || '').trim().slice(0, 500)
  if (!rejectionReason) return res.status(400).json({ message: 'Please provide a reason for rejecting this order.' })
  const order = await Order.findById(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const has = order.items.some((item) => belongs(item, id, req.user.name) && item.status === 'pending')
  if (!has) return res.status(400).json({ message: 'No pending items for this pharmacy in the selected order' })
  order.items = order.items.map((item) => belongs(item, id, req.user.name) && item.status === 'pending'
    ? { ...item.toObject(), status: 'rejected', rejectionReason }
    : item)
  order.status = recalc(order.items)
  await order.save()
  if (order.paymentMethod === 'chapa') {
    await Transaction.updateMany({ order: order._id, pharmacy: id }, { status: 'refunded', updatedAt: new Date() })
  }
  await updateOrderTransactions(order)
  res.json({ message: 'Order declined for this pharmacy.', order })
}

exports.listTransactions = async (req, res) => {
  const filter = { customer: req.user._id, ...weekFilter(req.query.period) }
  const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).populate('order')
  res.json({ transactions })
}

exports.listPharmacyTransactions = async (req, res) => {
  const filter = { pharmacy: req.user._id, ...weekFilter(req.query.period) }
  const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).populate('order')
  res.json({ transactions })
}
