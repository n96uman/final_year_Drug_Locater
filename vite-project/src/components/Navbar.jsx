import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function navSubtitle(user) {
  if (!user) return 'Medicine search · Hawassa'
  if (user.role === 'customer') return 'Customer account'
  if (user.role === 'admin') return 'Administrator'
  if (user.role === 'pharmacy' && user.pharmacyApprovalStatus === 'pending') return 'Pharmacy · Awaiting approval'
  if (user.role === 'pharmacy') return 'Pharmacy account'
  return 'E-Pharmacy'
}

export default function Navbar() {
  const { currentUser, logout } = useAuth()
  const nav = useNavigate()
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
            <span>{navSubtitle(currentUser)}</span>
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
            {currentUser?.role === 'admin' ? <li><NavLink to="/admin">Admin approvals</NavLink></li> : null}
            {!currentUser ? (
              <>
                <li><NavLink to="/login">Login</NavLink></li>
                <li><NavLink to="/register">Register</NavLink></li>
              </>
            ) : (
              <li>
                <button
                  type="button"
                  className="nav-link-btn"
                  onClick={() => {
                    logout()
                    nav('/login', { replace: true })
                  }}
                >
                  Sign out
                </button>
              </li>
            )}
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
