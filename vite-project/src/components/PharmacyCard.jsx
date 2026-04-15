import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'

export default function PharmacyCard({ medicine, onAddToCart }) {
  const { currentUser } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const add = () => {
    if (!currentUser) return nav('/login', { state: { from: location.pathname } })
    if (currentUser.role !== 'customer') return nav('/pharmacy-dashboard')
    onAddToCart(medicine)
  }

  return (
    <article className="pharmacy-result-card">
      <h3>{medicine.pharmacyName}</h3>
      <p>{medicine.name}</p>
      <div className="pharmacy-result-card__row">
        <span className="pharmacy-result-card__qty">Available: <strong>{medicine.quantity ?? 0}</strong></span>
        <span className="pharmacy-result-card__price">{medicine.price} ETB</span>
      </div>
      <button type="button" className="btn btn--primary btn--sm" onClick={add}>Add to Cart</button>
    </article>
  )
}
