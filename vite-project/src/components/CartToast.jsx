import { useCart } from '../context/CartContext'

export default function CartToast() {
  const { notice, dismissNotice } = useCart()
  if (!notice) return null
  return (
    <div className="cart-toast" role="status" aria-live="polite">
      <p className="cart-toast__text">{notice}</p>
      <button type="button" aria-label="Close popup" onClick={dismissNotice}>x</button>
    </div>
  )
}
