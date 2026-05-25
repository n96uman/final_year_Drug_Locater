import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import siteIcon from '../assets/drug_pic.png'

function navSubtitle(user) {
  if (!user) return 'Medicine search · Hawassa'
  if (user.role === 'customer') return 'Customer account'
  if (user.role === 'admin') return 'Administrator'
  if (user.role === 'pharmacy' && user.pharmacyApprovalStatus === 'pending') return 'Pharmacy · Awaiting approval'
  if (user.role === 'pharmacy') return 'Pharmacy account'
  return 'E-Pharmacy'
}

export default function Navbar() {
  const { currentUser } = useAuth()
  const [theme, setTheme] = useState('light')
  const location = useLocation()
  const closeMainNav = () => {
    const navMenu = document.getElementById('nav-menu')
    if (navMenu) navMenu.checked = false
  }

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

  // Hide navbar menu on mobile after navigation
  useEffect(() => {
    const navMenu = document.getElementById('nav-menu')
    if (navMenu) navMenu.checked = false
  }, [location])

  return (
    <header className="site-header">
      <div className="header-inner">
        <p className="site-title">
          <NavLink to="/" className="site-title__link">
            <img className="site-title__icon" src={siteIcon} alt="" width={36} height={36} decoding="async" />
            <span className="site-title__text">
              E-Pharmacy
              <span>{navSubtitle(currentUser)}</span>
            </span>
          </NavLink>
        </p>
        <input type="checkbox" id="nav-menu" className="nav-menu-checkbox" hidden />
        <label htmlFor="nav-menu" className="nav-toggle" aria-label="Toggle navigation menu">
          <span className="nav-toggle-icon" aria-hidden="true"></span>
        </label>
        <nav className="main-nav" aria-label="Primary">
          <ul>
            <li><NavLink to="/search" onClick={closeMainNav}>Search Medicine</NavLink></li>
            <li><NavLink to="/pharmacies" onClick={closeMainNav}>Pharmacies</NavLink></li>
            {currentUser?.role === 'customer' ? <li><NavLink to="/cart" onClick={closeMainNav}>Cart</NavLink></li> : null}
            {currentUser?.role === 'customer' ? <li><NavLink to="/profile" onClick={closeMainNav}>Profile</NavLink></li> : null}
            {currentUser?.role === 'pharmacy' && currentUser?.pharmacyApprovalStatus !== 'approved' ? (
              <li><NavLink to="/pharmacy-pending" onClick={closeMainNav}>Account status</NavLink></li>
            ) : null}
            {currentUser?.role === 'pharmacy' && currentUser?.pharmacyApprovalStatus === 'approved' ? (
              <li><NavLink to="/pharmacy-dashboard" onClick={closeMainNav}>Dashboard</NavLink></li>
              ) : null}
            {currentUser?.role === 'admin' ? <li><NavLink to="/admin" onClick={closeMainNav}>Admin</NavLink></li> : null}
            {!currentUser ? <li><NavLink to="/login" onClick={closeMainNav}>Login</NavLink></li> : null}
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
