import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'

export default function MedicineCard({ medicine, onAddToCart }) {
  const { currentUser } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const add = () => {
    if (!currentUser) return nav('/login', { state: { from: location.pathname } })
    if (currentUser.role !== 'customer') return nav('/pharmacy-dashboard')
    onAddToCart(medicine)
  }

  return (
    <article className="medicine-card">
      <h3 className="medicine-card__name">{medicine.name}</h3>
      <dl className="medicine-card__meta">
        <div><dt>Pharmacy</dt><dd>{medicine.pharmacyName}</dd></div>
        <div><dt>Stock</dt><dd>{medicine.quantity ?? 0}</dd></div>
      </dl>
      <div className="medicine-card__pricing">
        <p className="medicine-card__price--solo">{medicine.price} ETB</p>
      </div>
      <button type="button" className="btn btn--primary btn--sm" onClick={add}>Add to Cart</button>
    </article>
  )
}
