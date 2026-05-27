import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'

function openDirections(pharmacyLat, pharmacyLng, pharmacyLocation) {
  if (pharmacyLat != null && pharmacyLng != null) {
    const dest = `${pharmacyLat},${pharmacyLng}`
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`
          window.open(
            `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
            '_blank',
            'noopener,noreferrer'
          )
        },
        () => {
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
            '_blank',
            'noopener,noreferrer'
          )
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  } else if (pharmacyLocation) {
    const dest = encodeURIComponent(pharmacyLocation)
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer'
    )
  }
}

export default function PharmacyCard({ medicine, onAddToCart }) {
  const { currentUser } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const add = () => {
    if (!currentUser) return nav('/login', { state: { from: location.pathname } })
    if (currentUser.role !== 'customer') return nav('/pharmacy-dashboard')
    onAddToCart(medicine)
  }

  const hasLocation = (medicine.pharmacyLat != null && medicine.pharmacyLng != null) || medicine.pharmacyLocation

  return (
    <article className="pharmacy-result-card">
      <h3>{medicine.pharmacyName}</h3>
      <p>{medicine.name}</p>
      {medicine.pharmacyLocation ? <p className="form-hint">{medicine.pharmacyLocation}</p> : null}
      <div className="pharmacy-result-card__row">
        <span className="pharmacy-result-card__qty">Available: <strong>{medicine.quantity ?? 0}</strong></span>
        <span className="pharmacy-result-card__price">{medicine.price} ETB</span>
      </div>
      {medicine.expiry ? <p className="form-hint">Expiry: {medicine.expiry}</p> : null}
      {medicine.distanceKm != null ? <p className="form-hint">Distance: {medicine.distanceKm.toFixed(1)} km</p> : null}
      <div className="pharmacy-result-card__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={add}>Add to Cart</button>
        {hasLocation ? (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => openDirections(medicine.pharmacyLat, medicine.pharmacyLng, medicine.pharmacyLocation)}
            aria-label={`Get directions to ${medicine.pharmacyName}`}
          >
            🗺 Get Directions
          </button>
        ) : null}
      </div>
    </article>
  )
}
