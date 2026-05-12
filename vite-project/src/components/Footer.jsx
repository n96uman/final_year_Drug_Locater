import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <p className="footer-brand">E-Pharmacy</p>
          <p>
            Location-based medicine search for <strong>Hawassa City</strong>. Customers find stock; pharmacies manage listings and orders.
          </p>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/search">Search</Link>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
            <Link to="/pharmacies">Pharmacies</Link>
          </nav>
        </div>
        <div className="footer-meta">
          <p>Hawassa, Ethiopia</p>
          <p>&copy; <time dateTime="2026">2026</time> E-Pharmacy</p>
        </div>
      </div>
    </footer>
  )
}
