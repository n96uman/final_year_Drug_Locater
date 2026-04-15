import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { currentUser } = useAuth()

  return (
    <header className="site-header">
      <div className="header-inner">
        <p className="site-title">
          <NavLink to="/">
            E-Pharmacy Drug Locator
            <span>Hawassa City · Customer</span>
          </NavLink>
        </p>
        <input type="checkbox" id="nav-menu" className="nav-menu-checkbox" hidden />
        <label htmlFor="nav-menu" className="nav-toggle" aria-label="Toggle navigation menu">
          <span className="nav-toggle-icon" aria-hidden="true"></span>
        </label>
        <nav className="main-nav" aria-label="Primary">
          <ul>
            <li><NavLink to="/search">Search Medicine</NavLink></li>
            <li><NavLink to="/pharmacies">Pharmacies</NavLink></li>
            {currentUser?.role === 'customer' ? <li><NavLink to="/cart">Cart</NavLink></li> : null}
            {currentUser?.role === 'customer' ? <li><NavLink to="/profile">Profile</NavLink></li> : null}
            {currentUser?.role === 'pharmacy' ? <li><NavLink to="/pharmacy-dashboard">Dashboard</NavLink></li> : null}
            {!currentUser ? <li><NavLink to="/login">Login</NavLink></li> : null}
          </ul>
        </nav>
      </div>
    </header>
  )
}
