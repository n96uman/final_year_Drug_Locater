const Order = require('../models/Order')
const Medicine = require('../models/Medicine')
const Transaction = require('../models/Transaction')

const CHAPA_API_BASE = 'https://api.chapa.co/v1'
const recalc = (items) => { const s = items.map((i) => i.status); if (s.every((x) => x === 'approved')) return 'approved'; if (s.every((x) => x === 'rejected')) return 'rejected'; if (s.some((x) => x === 'approved')) return 'partially_approved'; return 'pending' }
const belongs = (i, id, name) => (i.pharmacyId && String(i.pharmacyId) === String(id)) || i.pharmacyName === name

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

exports.createOrder = async (req, res) => {
  const paymentMethod = req.body.paymentMethod === 'chapa' ? 'chapa' : 'none'
  const final = []
  for (const raw of req.body.items || []) {
    const qty = Number(raw.quantity)
    const med = await Medicine.findById(raw.medicineId)
    if (!med) return res.status(404).json({ message: 'Medicine not found' })
    if (med.quantity < qty) return res.status(400).json({ message: `You cannot checkout ${qty} of ${med.name}. Only ${med.quantity} available.` })
    final.push({ medicineId: med._id, pharmacyId: med.createdBy, medicineName: med.name, pharmacyName: med.pharmacyName, price: Number(med.price), quantity: qty, status: 'pending' })
  }
  const subtotal = final.reduce((s, i) => s + i.price * i.quantity, 0)
  const delivery = final.length ? 50 : 0
  const total = subtotal + delivery
  const order = await Order.create({ customer: req.user._id, items: final, subtotal, delivery, total, status: 'pending', paymentMethod, paymentStatus: paymentMethod === 'chapa' ? 'pending' : 'pending' })
  if (paymentMethod === 'chapa') {
    // Create a pending transaction
    await Transaction.create({ order: order._id, customer: req.user._id, amount: total, status: 'pending', type: 'chapa' })
    const chapa = await initChapaTransaction(order, req.user)
    return res.status(201).json({ order: chapa.order, checkoutUrl: chapa.checkoutUrl, message: 'Order created. Redirecting to Chapa for payment.' })
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
    // Mark transaction as failed
    await Transaction.updateOne({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
    return res.json({ status: 'failed', paymentStatus: order.paymentStatus, order, result: body })
  }
  const transactionStatus = body.data?.status
  if (transactionStatus === 'success') {
    order.paymentStatus = 'paid'
    await order.save()
    // Mark transaction as paid
    await Transaction.updateOne({ order: order._id }, { status: 'pending', updatedAt: new Date() })
    return res.json({ status: 'paid', paymentStatus: order.paymentStatus, order })
  }
  order.paymentStatus = 'failed'
  await order.save()
  await Transaction.updateOne({ order: order._id }, { status: 'refunded', updatedAt: new Date() })
  res.json({ status: 'failed', paymentStatus: order.paymentStatus, order, result: body })
}

exports.getMyOrders = async (req, res) => res.json({ orders: await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }) })
exports.getPharmacyOrders = async (req, res) => { const id = req.user._id; const orders = await Order.find({ $or: [{ 'items.pharmacyId': id }, { 'items.pharmacyName': req.user.name }] }).populate('customer','name email').sort({ createdAt: -1 }); res.json({ orders: orders.map((o) => ({ id: o._id, customer: o.customer, createdAt: o.createdAt, status: o.status, items: o.items.filter((i) => belongs(i,id,req.user.name)) })) }) }

  for (const it of list) { await Medicine.updateOne({ _id: it.medicineId, quantity: { $gte: it.quantity } }, { $inc: { quantity: -it.quantity } }) }
  o.items = o.items.map((i) => belongs(i,id,req.user.name) && i.status === 'pending' ? { ...i.toObject(), status: 'approved', approvedAt: new Date() } : i)
  o.status = recalc(o.items)
  await o.save()
  res.json({ message: 'Order approved and stock updated.', order: o }) }
exports.approvePharmacyOrder = async (req, res) => {
  const id = req.user._id;
  const o = await Order.findById(req.params.orderId);
  if (!o) return res.status(404).json({ message: 'Order not found' });
  const list = o.items.filter((i) => belongs(i, id, req.user.name) && i.status === 'pending');
  if (!list.length) return res.status(400).json({ message: 'No pending items for this pharmacy in the selected order' });
  for (const it of list) {
    const m = await Medicine.findById(it.medicineId);
    if (!m || m.quantity < it.quantity) return res.status(400).json({ message: `Cannot approve ${it.medicineName}. Requested ${it.quantity}, available ${m ? m.quantity : 0}.` });
  }
  for (const it of list) {
    await Medicine.updateOne({ _id: it.medicineId, quantity: { $gte: it.quantity } }, { $inc: { quantity: -it.quantity } });
  }
  o.items = o.items.map((i) => belongs(i, id, req.user.name) && i.status === 'pending' ? { ...i.toObject(), status: 'approved', approvedAt: new Date() } : i);
  o.status = recalc(o.items);
  await o.save();
  // If all items approved and payment is chapa, mark transaction as completed
  if (o.paymentMethod === 'chapa' && o.status === 'approved') {
    await Transaction.updateOne({ order: o._id }, { status: 'completed', updatedAt: new Date() });
    // TODO: Transfer money to pharmacy (simulate)
  }
  res.json({ message: 'Order approved and stock updated.', order: o });
}

exports.rejectPharmacyOrder = async (req, res) => {
  const id = req.user._id;
  const o = await Order.findById(req.params.orderId);
  if (!o) return res.status(404).json({ message: 'Order not found' });
  const has = o.items.some((i) => belongs(i, id, req.user.name) && i.status === 'pending');
  if (!has) return res.status(400).json({ message: 'No pending items for this pharmacy in the selected order' });
  o.items = o.items.map((i) => belongs(i, id, req.user.name) && i.status === 'pending' ? { ...i.toObject(), status: 'rejected' } : i);
  o.status = recalc(o.items);
  await o.save();
  // If all items rejected and payment is chapa, refund
  if (o.paymentMethod === 'chapa' && o.status === 'rejected') {
    await Transaction.updateOne({ order: o._id }, { status: 'refunded', updatedAt: new Date() });
    // TODO: Refund money to customer (simulate)
  }
  res.json({ message: 'Order declined for this pharmacy.', order: o });
}
// List transactions for a customer (this week or all)
exports.listTransactions = async (req, res) => {
  const { period } = req.query;
  const userId = req.user._id;
  let filter = { customer: userId };
  if (period === 'week') {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    filter.createdAt = { $gte: startOfWeek };
  }
  const txs = await Transaction.find(filter).sort({ createdAt: -1 }).populate('order');
  res.json({ transactions: txs });
};
