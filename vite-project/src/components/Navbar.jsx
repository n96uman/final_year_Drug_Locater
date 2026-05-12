import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { currentUser } = useAuth()
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (preferredDark ? 'dark' : 'light')
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <p className="site-title">
          <NavLink to="/">
            E-Pharmacy
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
            {currentUser?.role === 'pharmacy' && currentUser?.pharmacyApprovalStatus !== 'approved' ? <li><NavLink to="/pharmacy-pending">Account status</NavLink></li> : null}
            {currentUser?.role === 'pharmacy' && currentUser?.pharmacyApprovalStatus === 'approved' ? <li><NavLink to="/pharmacy-dashboard">Dashboard</NavLink></li> : null}
            {currentUser?.role === 'admin' ? <li><NavLink to="/admin">Admin</NavLink></li> : null}
            {!currentUser ? <li><NavLink to="/login">Login</NavLink></li> : null}
            <li>
              <button
                type="button"
                className="theme-toggle"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                <span aria-hidden="true">{theme === 'dark' ? '☀' : '🌙'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
