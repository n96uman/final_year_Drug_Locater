const Order = require('../models/Order')
const Medicine = require('../models/Medicine')
const Transaction = require('../models/Transaction')
const { filePublicUrl } = require('../utils/publicFileUrl')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')

const CHAPA_API_BASE = 'https://api.chapa.co/v1'
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

const getNameParts = (name = '') => {
  const parts = String(name).trim().split(' ').filter(Boolean)
  return { firstName: parts[0] || 'Customer', lastName: parts.slice(1).join(' ') || 'User' }
}

const initChapaTransaction = async (order, user) => {
  const secretKey = process.env.CHAPA_SECRET_KEY
  if (!secretKey) throw new Error('Chapa secret key is not configured.')
  const { firstName, lastName } = getNameParts(user.name || user.email)
  const callbackUrl = process.env.CHAPA_RETURN_URL || process.env.CHAPA_CALLBACK_URL || 'http://localhost:5173/payment/callback'
  const txRef = `order_${order._id}_${Date.now()}`
  const payload = {
    amount: Number(order.total),
    currency: 'ETB',
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    tx_ref: txRef,
    callback_url: callbackUrl,
    return_url: callbackUrl,
    title: `E-Pharmacy order ${order._id}`,
    description: `Payment for order ${order._id}`,
  }
  const response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  if (!body || body.status !== 'success' || !body.data?.checkout_url) {
    throw new Error(body?.message || 'Chapa payment initialization failed.')
  }
  order.paymentMethod = 'chapa'
  order.paymentReference = txRef
  order.paymentStatus = 'pending'
  await order.save()
  return { order, checkoutUrl: body.data.checkout_url }
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
  const paymentMethod = req.body.paymentMethod === 'chapa' ? 'chapa' : 'none'
  const requestedItems = bodyJson(req.body.items, [])
  const receiptPath = req.file ? sanitizeUploadPath(`/uploads/${req.file.filename}`) : ''
  if (!receiptPath) return res.status(400).json({ message: 'Please upload a receipt photo before checkout.' })
  const final = []
  for (const raw of requestedItems || []) {
    const qty = Number(raw.quantity)
    const med = await Medicine.findById(raw.medicineId)
    if (!med) return res.status(404).json({ message: 'Medicine not found' })
    if (med.quantity < qty) return res.status(400).json({ message: `You cannot checkout ${qty} of ${med.name}. Only ${med.quantity} available.` })
    final.push({ medicineId: med._id, pharmacyId: med.createdBy, medicineName: med.name, pharmacyName: med.pharmacyName, price: Number(med.price), quantity: qty, status: 'pending' })
  }
  const subtotal = final.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = final.length ? 50 : 0
  const total = subtotal + delivery
  const order = await Order.create({ customer: req.user._id, items: final, subtotal, delivery, total, status: 'pending', paymentMethod, paymentStatus: 'pending', receiptImage: receiptPath })
  if (paymentMethod === 'chapa') {
    try {
      const chapa = await initChapaTransaction(order, req.user)
      await createPharmacyTransactions(chapa.order)
      return res.status(201).json({ order: chapa.order, checkoutUrl: chapa.checkoutUrl, message: 'Order created. Redirecting to Chapa for payment.' })
    } catch (e) {
      await Order.deleteOne({ _id: order._id })
      throw e
    }
  }
  res.status(201).json({ order, message: 'Order placed and waiting pharmacy approval.' })
}

exports.verifyChapaPayment = async (req, res) => {
  const { txRef } = req.body
  if (!txRef) return res.status(400).json({ message: 'txRef is required.' })
  const order = await Order.findOne({ paymentReference: txRef, customer: req.user._id })
  if (!order) return res.status(404).json({ message: 'Payment order not found.' })
  const secretKey = process.env.CHAPA_SECRET_KEY
  if (!secretKey) return res.status(500).json({ message: 'Chapa secret key is not configured.' })
  const response = await fetch(`${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  })
  const body = await response.json()
  if (!body || body.status !== 'success') {
    order.paymentStatus = 'failed'
    await order.save()
    await Transaction.updateMany({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
    return res.json({ status: 'failed', paymentStatus: order.paymentStatus, order, result: body })
  }
  if (body.data?.status === 'success') {
    order.paymentStatus = 'paid'
    await order.save()
    await Transaction.updateMany({ order: order._id }, { status: 'pending', updatedAt: new Date() })
    return res.json({ status: 'paid', paymentStatus: order.paymentStatus, order })
  }
  order.paymentStatus = 'failed'
  await order.save()
  await Transaction.updateMany({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
  res.json({ status: 'failed', paymentStatus: order.paymentStatus, order, result: body })
}

exports.getMyOrders = async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 })
  res.json({ orders: orders.map((order) => ({ ...order.toObject(), receiptImage: img(req, order.receiptImage) })) })
}

exports.getPharmacyOrders = async (req, res) => {
  const id = req.user._id
  const orders = await Order.find({ status: { $ne: 'cancelled' }, $or: [{ 'items.pharmacyId': id }, { 'items.pharmacyName': req.user.name }] }).populate('customer', 'name email').sort({ createdAt: -1 })
  res.json({ orders: orders.map((order) => ({ id: order._id, customer: order.customer, createdAt: order.createdAt, status: order.status, paymentMethod: order.paymentMethod, receiptImage: img(req, order.receiptImage), items: order.items.filter((item) => belongs(item, id, req.user.name)) })) })
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
  res.json({ message: order.paymentMethod === 'chapa' ? 'Order cancelled. Your Chapa test payment has been returned.' : 'Order cancelled.', order })
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
  const order = await Order.findById(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const has = order.items.some((item) => belongs(item, id, req.user.name) && item.status === 'pending')
  if (!has) return res.status(400).json({ message: 'No pending items for this pharmacy in the selected order' })
  order.items = order.items.map((item) => belongs(item, id, req.user.name) && item.status === 'pending' ? { ...item.toObject(), status: 'rejected' } : item)
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
