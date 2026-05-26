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
          // fallback: open destination only, let Google Maps ask for origin
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

export default function MedicineCard({ medicine, onAddToCart }) {
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
    <article className="medicine-card">
      <h3 className="medicine-card__name">{medicine.name}</h3>
      <dl className="medicine-card__meta">
        <div><dt>Pharmacy</dt><dd>{medicine.pharmacyName}</dd></div>
        <div><dt>Stock</dt><dd>{medicine.quantity ?? 0}</dd></div>
        {medicine.distanceKm != null ? <div><dt>Distance</dt><dd>{medicine.distanceKm.toFixed(1)} km</dd></div> : null}
      </dl>
      <div className="medicine-card__pricing">
        <p className="medicine-card__price--solo">{medicine.price} ETB</p>
      </div>
      <div className="medicine-card__actions">
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
