import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { orderApi } from '../api/client'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)
const KEY = 'dl_cart_state'
const getId = (i) => i._id || i.id
const getUserId = (user) => user?._id || user?.id || null
const countOrderItems = (order) => {
  const items = order?.items || []
  return {
    total: items.length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    pending: items.filter((i) => i.status === 'pending').length,
    status: order?.status || 'pending',
    updatedAt: new Date().toISOString(),
  }
}

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { userId: null, cartItems: [], cartStatus: 'active', pendingOrderId: null, orderHistory: null }
  } catch {
    return { userId: null, cartItems: [], cartStatus: 'active', pendingOrderId: null, orderHistory: null }
  }
}

export function CartProvider({ children }) {
  const { token, currentUser } = useAuth()
  const init = useMemo(readSaved, [])
  const [cartItems, setCartItems] = useState(init.cartItems || [])
  const [cartStatus, setCartStatus] = useState(init.cartStatus || 'active')
  const [pendingOrderId, setPendingOrderId] = useState(init.pendingOrderId || null)
  const [cartUserId, setCartUserId] = useState(init.userId || null)
  const [orderHistory, setOrderHistory] = useState(init.orderHistory || null)
  const [notice, setNotice] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const t = useRef(null)

  useEffect(() => {
    const currentUserId = getUserId(currentUser)
    if (!currentUserId || currentUser.role !== 'customer') return
    if (!cartUserId) setCartUserId(currentUserId)
    else if (cartUserId !== currentUserId) {
      setCartItems([]); setCartStatus('active'); setPendingOrderId(null); setOrderHistory(null); setCartUserId(currentUserId)
    }
  }, [currentUser?._id, currentUser?.id, currentUser?.role, cartUserId])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ userId: cartUserId, cartItems, cartStatus, pendingOrderId, orderHistory }))
  }, [cartUserId, cartItems, cartStatus, pendingOrderId, orderHistory])

  const show = (m) => { setNotice(m); clearTimeout(t.current); t.current = setTimeout(() => setNotice(''), 4500) }
  const dismissNotice = () => { clearTimeout(t.current); setNotice('') }
  const notify = (message) => show(message)

  const addToCart = (m) => {
    if (!currentUser || currentUser.role !== 'customer') return show('Please login as a customer to add items to cart.')
    if (cartStatus === 'waiting') return show('Order waiting for approval.')
    const id = getId(m)
    setCartItems((p) => {
      const ex = p.find((x) => getId(x) === id)
      if (ex) {
        show(`Increased ${m.name} quantity in cart.`)
        return p.map((x) => getId(x) === id ? { ...x, quantity: x.quantity + 1 } : x)
      }
      show(`${m.name} added to cart.`)
      return [...p, { ...m, quantity: 1 }]
    })
  }

  const updateQuantity = (id, q) => {
    if (cartStatus === 'waiting') return show('Cannot edit while waiting.')
    const qty = Number(q)
    if (qty <= 0) return setCartItems((p) => p.filter((x) => getId(x) !== id))
    setCartItems((p) => p.map((x) => getId(x) === id ? { ...x, quantity: qty } : x))
  }

  const removeFromCart = (id) => {
    if (cartStatus === 'waiting') return show('Cannot edit while waiting.')
    setCartItems((p) => p.filter((x) => getId(x) !== id))
  }

  const checkout = async () => {
    if (cartStatus === 'waiting') return { ok: false }
    if (!token || !currentUser || currentUser.role !== 'customer' || cartItems.length === 0) return { ok: false }
    setCheckoutLoading(true)
    try {
      const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
      const delivery = 50
      const total = subtotal + delivery
      const items = cartItems.map((i) => ({ medicineId: getId(i), medicineName: i.name, pharmacyName: i.pharmacyName, price: i.price, quantity: i.quantity }))
      const r = await orderApi.checkout({ items, subtotal, delivery, total }, token)
      setCartStatus('waiting')
      setPendingOrderId(r.order?._id || r.order?.id || null)
      setOrderHistory(countOrderItems(r.order))
      show('Checkout submitted. Status changed to waiting for pharmacy approval.')
      return { ok: true }
    } catch (e) {
      show(e.message)
      return { ok: false }
    } finally { setCheckoutLoading(false) }
  }

  const checkPendingOrderStatus = useCallback(async () => {
    if (cartStatus !== 'waiting' || !pendingOrderId || !token) return
    try {
      const d = await orderApi.listMine(token)
      const m = (d.orders || []).find((o) => (o._id || o.id) === pendingOrderId)
      if (!m) return
      setOrderHistory(countOrderItems(m))
      if (m.status === 'approved') { setCartItems([]); setCartStatus('active'); setPendingOrderId(null); show('Order approved. Cart cleared.') }
      if (m.status === 'rejected') { setCartItems([]); setCartStatus('active'); setPendingOrderId(null); show('Order declined by pharmacy. Cart cleared.') }
      if (m.status === 'partially_approved') { setCartStatus('active'); setPendingOrderId(null); show('Order partially approved. Check history summary.') }
    } catch {}
  }, [cartStatus, pendingOrderId, token])

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const delivery = cartItems.length ? 50 : 0
  const total = subtotal + delivery

  const value = useMemo(() => ({ cartItems, cartStatus, orderHistory, addToCart, updateQuantity, removeFromCart, checkout, checkoutLoading, checkPendingOrderStatus, subtotal, delivery, total, notice, dismissNotice, notify }), [cartItems, cartStatus, orderHistory, checkoutLoading, checkPendingOrderStatus, subtotal, delivery, total, notice])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
