import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CartToast from './components/CartToast'
import SearchBar from './components/SearchBar'
import MedicineCard from './components/MedicineCard'
import PharmacyCard from './components/PharmacyCard'
import CartItem from './components/CartItem'
import TransactionList from './components/TransactionList'
import { useAuth } from './context/AuthContext'
import { useCart } from './context/CartContext'
import { medicineApi, orderApi, adminApi, fetchAdminLicenseObjectUrl } from './api/client'
import { isStrongPassword, strongPasswordHint } from './utils/passwordPolicy'
import { redirectAfterAuth, pharmacyNeedsLocation } from './utils/authRedirect'
import FileInput from './components/FileInput'
import TermsAgreement from './components/TermsAgreement'
import { TERMS_SECTIONS, TERMS_TITLE } from './content/termsText'
import heroImage from './assets/pharm.jpg'

function PublicLayout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main id="main-content"><div className="page-inner">{children}</div></main>
      <CartToast />
      <Footer />
    </>
  )
}

function CustomerRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  const l = useLocation()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" state={{ from: l.pathname }} replace />
  if (currentUser.role === 'admin') return <Navigate to="/admin" replace />
  if (currentUser.role === 'pharmacy') {
    const s = currentUser.pharmacyApprovalStatus || 'approved'
    return <Navigate to={s === 'approved' ? '/pharmacy-dashboard' : '/pharmacy-pending'} replace />
  }
  if (currentUser.role !== 'customer') return <Navigate to="/" replace />
  return children
}

function PharmacyRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'pharmacy') return <Navigate to="/" replace />
  const status = currentUser.pharmacyApprovalStatus || 'approved'
  if (status !== 'approved') return <Navigate to="/pharmacy-pending" replace />
  if (pharmacyNeedsLocation(currentUser)) return <Navigate to="/pharmacy-location" replace />
  return children
}

function PharmacyLocationRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'pharmacy') return <Navigate to="/" replace />
  const status = currentUser.pharmacyApprovalStatus || 'approved'
  if (status !== 'approved') return <Navigate to="/pharmacy-pending" replace />
  if (!pharmacyNeedsLocation(currentUser)) return <Navigate to="/pharmacy-dashboard" replace />
  return children
}

function PharmacyPendingRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'pharmacy') return <Navigate to="/" replace />
  const status = currentUser.pharmacyApprovalStatus || 'approved'
  if (status === 'approved') return <Navigate to="/pharmacy-dashboard" replace />
  return children
}

function AdminRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  const l = useLocation()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" state={{ from: l.pathname }} replace />
  if (currentUser.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function Home({ medicines, loading, error }) {
  const { addToCart } = useCart()
  const featured = medicines.slice(0, 6)
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__content">
          <h2 id="hero-heading">Connect with pharmacies across Hawassa</h2>
          <p className="lead">Find medicines quickly, compare prices, and send checkout requests for pharmacy approval.</p>
          <Link className="btn btn--primary" to="/search">Search medicines</Link>
        </div>
        <aside className="hero__visual hero__visual--photo" aria-label="Healthcare illustration">
          <img className="hero__visual-img" src={heroImage} alt="Pharmacy in Hawassa" width={640} height={480} decoding="async" />
          <p className="hero__visual-caption">Smart search · Compare prices · Build your cart</p>
        </aside>
      </section>
      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="section-title">Featured medicines</h2>
        {loading ? <p className="form-hint">Loading…</p> : null}
        {!loading && error ? <p className="form-hint">{error}</p> : null}
        {!loading && !error && featured.length === 0 ? <p className="form-hint">No medicines found yet.</p> : null}
        {!loading && !error ? <div className="card-grid card-grid--medicines">{featured.map((m) => <MedicineCard key={m._id || m.id} medicine={m} onAddToCart={addToCart} />)}</div> : null}
      </section>
    </>
  )
}

const hasCoords = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
const distanceKm = (from, to) => {
  if (!from || !hasCoords(to?.lat, to?.lng)) return null
  const r = 6371
  const dLat = (Number(to.lat) - Number(from.lat)) * Math.PI / 180
  const dLng = (Number(to.lng) - Number(from.lng)) * Math.PI / 180
  const lat1 = Number(from.lat) * Math.PI / 180
  const lat2 = Number(to.lat) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function Search({ medicines, loading, error }) {
  const [q, setQ] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [customerCoords, setCustomerCoords] = useState(null)
  const [geoMsg, setGeoMsg] = useState('')
  const { addToCart } = useCart()
  const useMyLocation = () => {
    setGeoMsg('')
    if (!navigator.geolocation) {
      setGeoMsg('Location is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortMode('distance')
        setGeoMsg('Showing nearest pharmacies first.')
      },
      () => setGeoMsg('Could not get your location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  const filtered = useMemo(() => {
    const list = medicines
      .filter((m) => `${m.name || ''} ${m.genericName || ''} ${m.pharmacyName || ''}`.toLowerCase().includes(q.toLowerCase()))
      .map((m) => ({ ...m, distanceKm: distanceKm(customerCoords, { lat: m.pharmacyLat, lng: m.pharmacyLng }) }))
    if (sortMode === 'name') return list.sort((a, b) => String(a.pharmacyName || '').localeCompare(String(b.pharmacyName || '')))
    if (sortMode === 'distance') return list.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
    return list
  }, [q, medicines, sortMode, customerCoords])
  return (
    <>
      <header className="page-header"><h1>Search medicine</h1></header>
      <form className="search-bar search-bar--wide search-form-spacing" onSubmit={(e) => e.preventDefault()}><SearchBar value={q} onChange={setQ} /><button type="submit" className="btn btn--primary">Search</button></form>
      <div className="table-actions search-quick-actions">
        <button type="button" className={`btn btn--sm ${sortMode === 'distance' ? 'btn--primary' : 'btn--outline'}`} onClick={useMyLocation}>Based on distance</button>
        <button type="button" className={`btn btn--sm ${sortMode === 'name' ? 'btn--primary' : 'btn--outline'}`} onClick={() => setSortMode('name')}>Based on pharmacy name</button>
      </div>
      {geoMsg ? <p className="form-hint">{geoMsg}</p> : null}
      <div className="results-toolbar"><h2 className="section-title">Search results</h2></div>
      {loading ? <p className="form-hint">Loading…</p> : null}
      {!loading && error ? <p className="form-hint">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? <p className="form-hint">No medicine matches your search.</p> : null}
      {!loading && !error ? <section><div className="card-grid card-grid--medicines">{filtered.map((m) => <MedicineCard key={m._id || m.id} medicine={m} onAddToCart={addToCart} />)}</div></section> : null}
    </>
  )
}

function Pharmacies({ medicines, loading, error }) {
  const { addToCart } = useCart()
  return (
    <>
      <header className="page-header"><h1>Pharmacy results</h1></header>
      {loading ? <p className="form-hint">Loading…</p> : null}
      {!loading && error ? <p className="form-hint">{error}</p> : null}
      {!loading && !error && medicines.length === 0 ? <p className="form-hint">No pharmacy medicines available right now.</p> : null}
      {!loading && !error ? <section><div className="card-grid card-grid--medicines">{medicines.map((m) => <PharmacyCard key={m._id || m.id} medicine={m} onAddToCart={addToCart} />)}</div></section> : null}
    </>
  )
}

function CartPage() {
  const { token } = useAuth()
  const { cartItems, cartStatus, orderHistory, removeFromCart, updateQuantity, checkout, checkoutLoading, cancelPendingOrder, cancelLoading, checkPendingOrderStatus, subtotal, delivery, total } = useCart()
  const [useChapa, setUseChapa] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const [chapaAccount, setChapaAccount] = useState('')
  const [chapaDemoPassword, setChapaDemoPassword] = useState('')
  const [transactions, setTransactions] = useState([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsError, setTransactionsError] = useState('')
  useEffect(() => {
    if (cartStatus !== 'waiting') return
    checkPendingOrderStatus()
    const t = setInterval(checkPendingOrderStatus, 5000)
    return () => clearInterval(t)
  }, [cartStatus, checkPendingOrderStatus])
  useEffect(() => {
    if (!token) return
    setTransactionsLoading(true)
    setTransactionsError('')
    orderApi.listTransactions(token)
      .then((data) => setTransactions(data.transactions || []))
      .catch((e) => setTransactionsError(e.message || 'Could not load transactions.'))
      .finally(() => setTransactionsLoading(false))
  }, [token, cartStatus, orderHistory?.updatedAt])

  const handleCheckout = async () => {
    if (!useChapa && !receiptFile) return
    const result = await checkout(useChapa ? 'chapa' : 'none', receiptFile, { chapaAccount, chapaDemoPassword })
    if (result.ok) {
      setReceiptFile(null)
      setChapaAccount('')
      setChapaDemoPassword('')
    }
  }
  const handleCancelWaitingOrder = async () => {
    if (!window.confirm('Cancel this waiting order? You can edit your cart again after cancelling.')) return
    await cancelPendingOrder()
  }

  return (
    <>
      <header className="page-header"><h1>Shopping cart</h1><p>Status: {cartStatus === 'waiting' ? 'Waiting pharmacy approval' : 'Ready to checkout'}</p></header>
      <div className="cart-layout">
        <div className="cart-table-wrap">
          {cartItems.length ? (
            <table className="cart-table"><thead><tr><th>Medicine name</th><th>Pharmacy name</th><th>Price</th><th>Quantity</th><th>Action</th></tr></thead><tbody>{cartItems.map((i) => <CartItem key={i._id || i.id} item={i} onRemove={removeFromCart} onUpdateQuantity={updateQuantity} />)}</tbody></table>
          ) : <div className="cart-empty"><p>Your cart is empty.</p><Link to="/search" className="btn btn--outline">Find medicines</Link></div>}
        </div>
        <aside className="cart-summary">
          <h2>Order summary</h2>
          <div className="form-group">
            <label className="terms-block__check" htmlFor="use-chapa">
              <input id="use-chapa" type="checkbox" checked={useChapa} onChange={(e) => setUseChapa(e.target.checked)} />
              <span>Chapa payment {useChapa ? 'on' : 'off'}</span>
            </label>
            {useChapa ? <p className="form-hint">Chapa is demo-only. It does not connect to the real Chapa service.</p> : <p className="form-hint">Chapa is off. This will be sent as a checkout request only.</p>}
          </div>
          {useChapa ? (
            <>
              <div className="form-group">
                <label htmlFor="chapa-account">Chapa demo phone/account</label>
                <input id="chapa-account" value={chapaAccount} onChange={(e) => setChapaAccount(e.target.value)} placeholder="09... or demo account number" required />
              </div>
              <div className="form-group">
                <label htmlFor="chapa-demo-password">Demo password</label>
                <input id="chapa-demo-password" type="password" value={chapaDemoPassword} onChange={(e) => setChapaDemoPassword(e.target.value)} placeholder="Any test value" required />
                <p className="form-hint">For testing only. Do not enter a real Chapa password.</p>
              </div>
            </>
          ) : (
            <FileInput id="receipt-photo" label="Receipt photo" required fileName={receiptFile?.name} onChange={setReceiptFile} hint="Upload a clear payment or order receipt photo before checkout." />
          )}
          <div className="cart-summary__row"><span>Subtotal</span><span>{subtotal} ETB</span></div>
          <div className="cart-summary__row"><span>Delivery</span><span>{delivery} ETB</span></div>
          <div className="cart-summary__row cart-summary__row--total"><span>Total price</span><span>{total} ETB</span></div>
          <button type="button" className="btn btn--primary btn--block cart-checkout-spacer" disabled={checkoutLoading || cartStatus === 'waiting' || cartItems.length === 0 || (!useChapa && !receiptFile) || (useChapa && (!chapaAccount.trim() || !chapaDemoPassword.trim()))} onClick={handleCheckout}>{checkoutLoading ? 'Processing' : useChapa ? 'Pay with Chapa Demo' : 'Checkout'}</button>
        </aside>
      </div>
      {orderHistory ? (
        <section className="form-panel cart-history">
          <h2>Recent checkout history</h2>
          <div className="cart-summary__row"><span>Order status</span><span>{orderHistory.status}</span></div>
          <div className="cart-summary__row"><span>Approved items</span><span>{orderHistory.approved}</span></div>
          <div className="cart-summary__row cart-summary__row--declined"><span>Declined items</span><span>{orderHistory.rejected}</span></div>
          <div className="cart-summary__row"><span>Pending items</span><span>{orderHistory.pending}</span></div>
          {cartStatus === 'waiting' && orderHistory.pending > 0 && orderHistory.approved === 0 ? <button type="button" className="btn btn--danger btn--block" disabled={cancelLoading} onClick={handleCancelWaitingOrder}>{cancelLoading ? 'Cancelling...' : 'Cancel waiting order'}</button> : null}
          {cartStatus === 'waiting' && orderHistory.approved > 0 ? <p className="form-hint">This order has pharmacy approval and can no longer be cancelled.</p> : null}
        </section>
      ) : null}
      <section className="form-panel cart-history">
        <header className="section-header section-header--compact"><h2>Transaction history</h2></header>
        {transactionsLoading ? <p className="form-hint">Loading...</p> : null}
        {transactionsError ? <p className="form-hint" role="alert">{transactionsError}</p> : null}
        {!transactionsLoading && !transactionsError ? <TransactionList transactions={transactions} /> : null}
      </section>
    </>
  )
}

function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const submit = async (e) => {
    e.preventDefault()
    if (!acceptTerms) return setErr('Please accept the terms and conditions.')
    const r = await login({ email, password, acceptTerms })
    if (!r.ok) return setErr(r.message)
    redirectAfterAuth(r.user, nav, loc.state?.from)
  }
  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>Login</h1></header>
      <section className="form-panel">
        <form onSubmit={submit}>
          <div className="form-group"><label htmlFor="login-email">Email</label><input id="login-email" type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-password-wrap">
              <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="input-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <TermsAgreement checked={acceptTerms} onChange={setAcceptTerms} id="login-terms" />
          <button className="btn btn--primary btn--block" type="submit" disabled={!acceptTerms}>Sign in</button>
          {err ? <p className="form-hint" role="alert">{err}</p> : null}
        </form>
        <div className="auth-alt">
          <p className="auth-alt__label">Need an account?</p>
          <Link to="/register" className="btn btn--outline btn--block">Create account</Link>
        </div>
      </section>
    </div>
  )
}

function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [file, setFile] = useState(null)
  const [licenseFile, setLicenseFile] = useState(null)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const submit = async (e) => {
    e.preventDefault()
    if (!acceptTerms) return setErr('Please accept the terms and conditions.')
    if (!isStrongPassword(form.password)) return setErr(strongPasswordHint)
    if (form.password !== confirmPassword) return setErr('Passwords do not match.')
    if (form.role === 'pharmacy' && !licenseFile) return setErr('Please upload a clear photo of your pharmacy licence.')
    const r = await register({ ...form, profileFile: file, licenseFile: form.role === 'pharmacy' ? licenseFile : null, acceptTerms })
    if (!r.ok) return setErr(r.message)
    redirectAfterAuth(r.user, nav, '/')
  }
  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>Create account</h1></header>
      <section className="form-panel">
        <form onSubmit={submit}>
          <div className="form-group"><label htmlFor="reg-name">Full name</label><input id="reg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label htmlFor="reg-email">Email</label><input id="reg-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <div className="input-password-wrap">
              <input id="reg-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
              <button type="button" className="input-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <p className="form-hint form-hint--field">{strongPasswordHint}</p>
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm-password">Confirm password</label>
            <div className="input-password-wrap">
              <input id="reg-confirm-password" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              <button type="button" className="input-password-toggle" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm((v) => !v)}>
                {showConfirm ? '🙈' : '👁'}
              </button>
            </div>
            {confirmPassword && form.password !== confirmPassword ? <p className="form-hint form-hint--error" role="alert">Passwords do not match.</p> : null}
            {confirmPassword && form.password === confirmPassword ? <p className="form-hint form-hint--ok">Passwords match ✓</p> : null}
          </div>
          <div className="form-group">
            <label htmlFor="reg-role">Account type</label>
            <select id="reg-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="customer">Customer</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </div>
          {form.role === 'pharmacy' ? (
            <FileInput id="reg-licence" label="Pharmacy licence (photo)" required fileName={licenseFile?.name} onChange={setLicenseFile} hint="Only administrators can view your licence photo." />
          ) : null}
          <FileInput id="reg-photo" label="Profile picture (optional)" fileName={file?.name} onChange={setFile} />
          <TermsAgreement checked={acceptTerms} onChange={setAcceptTerms} id="register-terms" />
          <button className="btn btn--primary btn--block" type="submit" disabled={!acceptTerms}>Create account</button>
          {err ? <p className="form-hint" role="alert">{err}</p> : null}
        </form>
        <div className="auth-alt">
          <p className="auth-alt__label">Already registered?</p>
          <Link to="/login" className="btn btn--outline btn--block">Back to login</Link>
        </div>
      </section>
    </div>
  )
}

function PaymentCallback() {
  const { token } = useAuth()
  const { notify } = useCart()
  const location = useLocation()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const search = new URLSearchParams(location.search)
    const txRef = search.get('tx_ref') || search.get('txRef') || search.get('reference')
    if (!txRef) {
      setStatus('error')
      setMessage('Payment reference is missing.')
      return
    }

    ;(async () => {
      try {
        if (!token) throw new Error('Please sign in again to verify payment.')
        const result = await orderApi.verifyChapaPayment({ txRef }, token)
        if (result.status === 'paid') {
          setStatus('success')
          setMessage('Payment completed. Your order is now waiting for pharmacy approval.')
          notify('Chapa payment completed successfully.')
        } else {
          setStatus('failed')
          setMessage(result.message || 'Payment could not be verified. Please try again.')
          notify('Chapa payment was not approved. Your money will be returned.')
        }
      } catch (e) {
        setStatus('error')
        setMessage(e.message || 'Payment verification failed.')
        notify(e.message || 'Payment verification failed.')
      }
    })()
  }, [location.search, notify, token])

  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>Chapa payment status</h1></header>
      <section className="form-panel">
        {status === 'verifying' ? <p className="form-hint">Verifying payment, please wait…</p> : null}
        {(status === 'success' || status === 'failed' || status === 'error') ? <p className="form-hint" role={status === 'failed' || status === 'error' ? 'alert' : undefined}>{message}</p> : null}
        <Link to="/cart" className="btn btn--primary">Return to cart</Link>
      </section>
    </div>
  )
}

function TermsPage() {
  return (
    <div className="terms-page">
      <header className="page-header">
        <h1>{TERMS_TITLE}</h1>
        <p className="form-hint">Read this agreement before creating an account, signing in, uploading files, or placing orders.</p>
      </header>
      <section className="form-panel terms-page__panel" aria-label={TERMS_TITLE}>
        {TERMS_SECTIONS.map((section) => (
          <section className="terms-page__section" key={section.heading}>
            <h2>{section.heading}</h2>
            {(Array.isArray(section.body) ? section.body : [section.body]).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </section>
    </div>
  )
}

const fallbackProfileImage = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'

/**
 * Resolves an image src returned by the backend.
 * - Absolute URLs (http/https) are kept as-is so the browser fetches them directly.
 *   In local dev the Vite proxy forwards /uploads/* to the backend; in production
 *   the backend returns its own full origin so the URL is already correct.
 * - Relative paths are returned unchanged.
 */
const uploadImageSrc = (src) => {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src   // keep full URL — works in dev (proxy) and prod
  if (src.startsWith('/')) return src
  return `/${src}`
}
const profileImageSrc = (src) => uploadImageSrc(src) || fallbackProfileImage

function Profile() {
  const { currentUser, authLoading, refreshProfile, updateProfile, updatePharmacyLicense, logout } = useAuth()
  const nav = useNavigate()
  const isPharmacy = currentUser?.role === 'pharmacy'
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(currentUser?.name || '')
  const [location, setLocation] = useState(currentUser?.location || '')
  const [locationLat, setLocationLat] = useState(currentUser?.locationLat ?? '')
  const [locationLng, setLocationLng] = useState(currentUser?.locationLng ?? '')
  const [file, setFile] = useState(null)
  const [licenseFile, setLicenseFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [imageError, setImageError] = useState(false)
  useEffect(() => { refreshProfile() }, [])
  useEffect(() => {
    setName(currentUser?.name || '')
    setLocation(currentUser?.location || '')
    setLocationLat(currentUser?.locationLat ?? '')
    setLocationLng(currentUser?.locationLng ?? '')
    setImageError(false)
  }, [currentUser?.name, currentUser?.location, currentUser?.locationLat, currentUser?.locationLng, currentUser?.profileImage])
  if (authLoading) return <section className="form-panel form-panel--wide"><p className="form-hint">Loading profile...</p></section>
  if (!currentUser) return <section className="form-panel form-panel--wide"><p className="form-hint">Profile not found. Please login again.</p></section>
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const r = await updateProfile({ name, profileFile: file, location: isPharmacy ? location : undefined, locationLat: isPharmacy ? locationLat : undefined, locationLng: isPharmacy ? locationLng : undefined })
    if (!r.ok) {
      setSaving(false)
      return setMsg(r.message)
    }
    if (licenseFile && isPharmacy) {
      const lr = await updatePharmacyLicense(licenseFile)
      if (!lr.ok) {
        setSaving(false)
        return setMsg(lr.message)
      }
      setMsg(lr.message || 'Saved')
      setLicenseFile(null)
    } else {
      setMsg('Saved')
    }
    setFile(null)
    setEdit(false)
    setSaving(false)
    await refreshProfile()
  }
  const fillCurrentLocation = () => {
    if (!navigator.geolocation) return setMsg('Location is not supported in this browser.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude)
        setLocationLng(pos.coords.longitude)
        setMsg('Coordinates added.')
      },
      () => setMsg('Could not get location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  return (
    <section className="form-panel form-panel--wide profile-card">
      <div className="profile-card__header">
        <div className="profile-avatar-wrap">
          <img className="profile-avatar" src={imageError ? fallbackProfileImage : profileImageSrc(currentUser.profileImage)} alt="profile" onError={() => setImageError(true)} />
          <button type="button" className="profile-avatar-edit" aria-label="Edit profile" onClick={() => setEdit((p) => !p)}>✎</button>
        </div>
        <div>
          <h2>Profile</h2>
          <p className="form-hint">{currentUser.email}</p>
          {isPharmacy ? <p className="form-hint">Status: {currentUser.pharmacyApprovalStatus}</p> : null}
        </div>
      </div>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input value={name} disabled={!edit} onChange={(e) => setName(e.target.value)} /></div>
        {isPharmacy ? (
          <div className="form-group">
            <label htmlFor="profile-location">Pharmacy location (Hawassa)</label>
            <textarea id="profile-location" rows={3} value={location} disabled={!edit} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Tabor sub-city, near Hawassa University" />
            {edit ? <button type="button" className="btn btn--outline btn--sm" onClick={fillCurrentLocation}>Use current GPS location</button> : null}
            {hasCoords(locationLat, locationLng) ? <p className="form-hint">GPS: {Number(locationLat).toFixed(5)}, {Number(locationLng).toFixed(5)}</p> : <p className="form-hint">GPS coordinates help customers find the nearest pharmacy.</p>}
          </div>
        ) : null}
        {edit ? <FileInput label="Profile picture" fileName={file?.name} onChange={setFile} /> : null}
        {edit && isPharmacy ? (
          <FileInput label="Replace licence photo" fileName={licenseFile?.name} onChange={setLicenseFile} hint="Licence photos can only be viewed by administrators. Updating may require re-approval." />
        ) : null}
        {edit ? <button className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button> : null}
      </form>
      <p className="form-hint">{msg}</p>
      <button type="button" className="btn btn--danger" onClick={async () => { await logout(); nav('/login') }}>Sign out</button>
    </section>
  )
}

function PharmacyLocationPage() {
  const { currentUser, updateProfile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [location, setLocation] = useState(currentUser?.location || '')
  const [locationLat, setLocationLat] = useState(currentUser?.locationLat ?? '')
  const [locationLng, setLocationLng] = useState(currentUser?.locationLng ?? '')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const fillCurrentLocation = () => {
    setErr('')
    if (!navigator.geolocation) return setErr('Location is not supported in this browser.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude)
        setLocationLng(pos.coords.longitude)
      },
      () => setErr('Could not get location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  const save = async (e) => {
    e.preventDefault()
    if (!location.trim()) return setErr('Please enter your pharmacy address in Hawassa.')
    setSaving(true)
    const r = await updateProfile({ name: currentUser?.name || '', location: location.trim(), locationLat, locationLng })
    setSaving(false)
    if (!r.ok) return setErr(r.message)
    await refreshProfile()
    nav('/pharmacy-dashboard', { replace: true })
  }
  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>Pharmacy location</h1><p className="form-hint">Add your address so customers can find you in Hawassa.</p></header>
      <section className="form-panel">
        <form onSubmit={save}>
          <div className="form-group">
            <label htmlFor="pharmacy-location">Address / area</label>
            <textarea id="pharmacy-location" rows={4} value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="Street, sub-city, landmark..." />
            <button type="button" className="btn btn--outline btn--sm" onClick={fillCurrentLocation}>Use current GPS location</button>
            {hasCoords(locationLat, locationLng) ? <p className="form-hint">GPS: {Number(locationLat).toFixed(5)}, {Number(locationLng).toFixed(5)}</p> : <p className="form-hint">Add GPS coordinates for nearest-pharmacy recommendations.</p>}
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue to dashboard'}</button>
          {err ? <p className="form-hint" role="alert">{err}</p> : null}
        </form>
      </section>
    </div>
  )
}

function PharmacyLayout({ activeOrdersCount }) {
  const closeDashNav = () => {
    const menu = document.getElementById('dash-nav')
    if (menu) menu.checked = false
  }
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header site-header--portal"><div className="header-inner header-inner--portal"><p className="site-title"><Link to="/pharmacy-dashboard">E-Pharmacy<span>Pharmacy portal · Hawassa</span></Link></p><div className="portal-header-actions"><Link className="btn btn--outline btn--sm portal-home-link" to="/">Customer site</Link><span className="portal-badge">Active orders {activeOrdersCount}</span></div></div></header>
      <div className="dash-layout"><aside className="dash-sidebar"><input type="checkbox" id="dash-nav" className="dash-nav-checkbox" hidden /><label htmlFor="dash-nav" className="dash-nav-toggle">Menu</label><nav className="dash-nav"><ul><li><NavLink to="/pharmacy-dashboard" onClick={closeDashNav}>Dashboard</NavLink></li><li><NavLink to="/pharmacy-orders" onClick={closeDashNav}>Orders</NavLink></li><li><NavLink to="/inventory" onClick={closeDashNav}>Manage Medicines</NavLink></li><li><NavLink to="/add-medicine" onClick={closeDashNav}>Add Medicine</NavLink></li><li><NavLink to="/pharmacy-profile" onClick={closeDashNav}>Profile</NavLink></li></ul></nav></aside><main className="dash-main" id="main-content"><Outlet /></main></div>
      <CartToast />
      <Footer />
    </>
  )
}

function DashboardHome({ inventory, orders, weeklyTransactions }) {
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const approvedOrders = orders.filter((o) => o.status === 'approved').length
  const declinedOrders = orders.filter((o) => o.status === 'rejected').length
  const weeklyTransactionTotal = weeklyTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const now = new Date()
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  const expiringMedicines = inventory
    .filter((m) => {
      if (!m.expiry) return false
      const expiry = new Date(m.expiry)
      return !Number.isNaN(expiry.getTime()) && expiry <= soon
    })
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
  return (
    <>
      <h1 className="dash-title">Dashboard</h1>
      <div className="stat-grid"><article className="stat-card"><p className="stat-card__label">Total medicines</p><p className="stat-card__value">{inventory.length}</p></article><article className="stat-card"><p className="stat-card__label">Pending orders</p><p className="stat-card__value">{pendingOrders}</p></article><article className="stat-card"><p className="stat-card__label">Approved orders</p><p className="stat-card__value">{approvedOrders}</p></article><article className="stat-card"><p className="stat-card__label">Declined orders</p><p className="stat-card__value">{declinedOrders}</p></article><article className="stat-card"><p className="stat-card__label">Low stock (&lt; 10)</p><p className="stat-card__value">{inventory.filter((m) => Number(m.quantity) < 10).length}</p></article><article className="stat-card"><p className="stat-card__label">This week transactions</p><p className="stat-card__value">{weeklyTransactions.length}</p><p className="form-hint">{weeklyTransactionTotal} ETB</p></article></div>
      <section className="form-panel form-panel--full cart-history">
        <h2>This week transaction history</h2>
        <TransactionList transactions={weeklyTransactions} />
      </section>
      <section className="form-panel form-panel--full cart-history">
        <h2>Expiry alerts</h2>
        {!expiringMedicines.length ? <p className="form-hint">No medicines expiring in the next 30 days.</p> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Medicine</th><th>Quantity</th><th>Expiry date</th><th>Status</th></tr></thead><tbody>{expiringMedicines.map((m) => { const expiry = new Date(m.expiry); const expired = expiry < now; return <tr key={m._id || m.id}><th scope="row">{m.name}</th><td>{m.quantity}</td><td>{m.expiry}</td><td>{expired ? 'Expired' : 'Close to expiry'}</td></tr> })}</tbody></table></div>
        )}
      </section>
    </>
  )
}

function AddMedicine({ onAdd }) {
  const initial = { name: '', genericName: '', pharmacyName: '', price: '', quantity: '', expiry: '' }
  const [f, setF] = useState(initial)
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onAdd({ ...f, price: Number(f.price), quantity: Number(f.quantity) })
    setSaving(false)
    if (ok) setF(initial)
  }
  return <><h1 className="dash-title">Add medicine</h1><section className="form-panel form-panel--full"><form onSubmit={submit}><div className="form-grid-2"><div className="form-group"><label>Medicine name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div><div className="form-group"><label>Generic name</label><input value={f.genericName} onChange={(e) => setF({ ...f, genericName: e.target.value })} required /></div><div className="form-group"><label>Pharmacy name</label><input value={f.pharmacyName} onChange={(e) => setF({ ...f, pharmacyName: e.target.value })} required /></div><div className="form-group"><label>Price</label><input type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></div><div className="form-group"><label>Quantity</label><input type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required /></div><div className="form-group"><label>Expiry date</label><input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} required /></div></div><button className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save medicine'}</button></form></section></>
}

function Inventory({ inventory, onUpdate, onDelete }) {
  return <><h1 className="dash-title">Inventory management</h1><div className="table-scroll"><table className="data-table"><thead><tr><th>Medicine name</th><th>Price (ETB)</th><th>Quantity</th><th>Actions</th></tr></thead><tbody>{inventory.map((m) => <tr key={m._id}><th scope="row">{m.name}</th><td><input type="number" value={m.price} onChange={(e) => onUpdate(m._id, 'price', Number(e.target.value))} /></td><td><input type="number" value={m.quantity} onChange={(e) => onUpdate(m._id, 'quantity', Number(e.target.value))} /></td><td><div className="table-actions"><button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(m._id)}>Delete</button></div></td></tr>)}</tbody></table></div></>
}

function OrderReceipt({ src, orderId }) {
  const imageSrc = uploadImageSrc(src)
  if (!imageSrc) return <p className="form-hint">No receipt uploaded for this order.</p>
  return (
    <a className="order-receipt" href={imageSrc} target="_blank" rel="noreferrer">
      <img src={imageSrc} alt={`Receipt for order ${String(orderId).slice(-6)}`} loading="lazy" />
      <span>View receipt</span>
    </a>
  )
}

function PharmacyOrders({ orders, onApprove, onReject }) {
  const [busy, setBusy] = useState('')
  const [dismissedOrderIds, setDismissedOrderIds] = useState([])
  const visibleOrders = orders.filter((o) => !dismissedOrderIds.includes(o.id))
  const pendingOrdersCount = visibleOrders.filter((o) => o.items.some((item) => item.status === 'pending')).length
  const dismissOrder = (id) => setDismissedOrderIds((prev) => [...prev, id])
  const run = async (fn, id) => { setBusy(id); await fn(id); setBusy('') }
  return (
    <>
      <h1 className="dash-title">Orders</h1>
      {pendingOrdersCount > 0 ? <p className="form-hint">New orders waiting: {pendingOrdersCount}</p> : null}
      {!visibleOrders.length ? <p className="form-hint">No orders to show.</p> : null}
      <div className="card-grid card-grid--medicines">{visibleOrders.map((o) => { const hasPendingItems = o.items.some((item) => item.status === 'pending'); return <article className="form-panel pharmacy-order-card" key={o.id}><div className="pharmacy-order-card__top"><h2>Order #{String(o.id).slice(-6)}</h2>{!hasPendingItems ? <button type="button" className="pharmacy-order-card__close" aria-label="Remove old order" onClick={() => dismissOrder(o.id)}>x</button> : null}</div><p className="form-hint">Status: {o.status}</p><p className="form-hint">Payment: {o.paymentMethod === 'chapa' ? 'Chapa Demo' : 'Checkout'}</p>{o.chapaAccount ? <p className="form-hint">Chapa account: {o.chapaAccount}</p> : null}<OrderReceipt src={o.receiptImage} orderId={o.id} />{o.items.map((i) => <p key={`${i.medicineId}-${i.status}`}>{i.medicineName} - Qty {i.quantity} - {i.status}</p>)}{hasPendingItems ? <div className="table-actions"><button className="btn btn--primary btn--sm" disabled={busy === o.id} onClick={() => run(onApprove, o.id)}>Approve</button><button className="btn btn--danger btn--sm btn--danger-solid" disabled={busy === o.id} onClick={() => run(onReject, o.id)}>Decline</button></div> : null}</article> })}</div>
    </>
  )
}

function PharmacyPendingPage() {
  const { currentUser, refreshProfile, logout } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const status = currentUser?.pharmacyApprovalStatus || 'pending'
  useEffect(() => {
    if (currentUser?.role === 'pharmacy' && currentUser.pharmacyApprovalStatus === 'approved') {
      if (pharmacyNeedsLocation(currentUser)) nav('/pharmacy-location', { replace: true })
      else nav('/pharmacy-dashboard', { replace: true })
    }
  }, [currentUser, nav])
  const refresh = async () => {
    setBusy(true)
    await refreshProfile()
    setBusy(false)
  }
  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>Pharmacy pending approval</h1></header>
      <section className="form-panel">
        {status === 'pending' ? (
          <>
            <p className="form-hint">Awaiting admin review. <strong>{currentUser?.email}</strong></p>
            <div className="table-actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={refresh}>{busy ? 'Checking…' : 'Refresh status'}</button>
              <Link to="/" className="btn btn--outline">Home</Link>
            </div>
          </>
        ) : (
          <p>Registration was not approved.</p>
        )}
        <button type="button" className="btn btn--outline" style={{ marginTop: '1rem' }} onClick={async () => { await logout(); nav('/login') }}>Sign out</button>
      </section>
    </div>
  )
}

function AdminPharmacyLicenseImg({ userId, token }) {
  const [src, setSrc] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let cancelled = false
    let revoke = null
    setSrc(null)
    setErr('')
    ;(async () => {
      try {
        const { objectUrl, revoke: r } = await fetchAdminLicenseObjectUrl(userId, token)
        if (cancelled) {
          r()
          return
        }
        revoke = r
        setSrc(objectUrl)
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not load licence')
      }
    })()
    return () => {
      cancelled = true
      if (revoke) revoke()
    }
  }, [userId, token])
  if (err) return <p className="form-hint">{err}</p>
  if (!src) return <p className="form-hint">Loading licence…</p>
  return (
    <a href={src} target="_blank" rel="noreferrer" className="admin-licence-thumb">
      <img src={src} alt="Licence" style={{ maxWidth: '100%', borderRadius: 8 }} />
    </a>
  )
}

function AdminPage() {
  const { token, logout } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('pending')
  const [stats, setStats] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [statsRes, listRes] = await Promise.all([
        adminApi.stats(token),
        adminApi.listPharmacies(tab, token),
      ])
      setStats(statsRes.stats || null)
      setList(listRes.pharmacies || [])
    } catch (e) {
      setError(e.message || 'Could not load admin data.')
      setList([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [token, tab])
  const run = async (fn, id) => {
    setBusyId(id)
    try {
      await fn(id, token)
      await load()
    } catch (e) {
      setError(e.message || 'Action failed.')
    } finally {
      setBusyId('')
    }
  }
  return (
    <div className="page-inner">
      <header className="page-header"><h1>Admin console</h1><p className="form-hint">Review pharmacy registrations and licences.</p></header>
      {stats ? (
        <div className="stat-grid admin-stat-grid">
          <article className="stat-card"><p className="stat-card__label">Pending</p><p className="stat-card__value">{stats.pendingPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Approved</p><p className="stat-card__value">{stats.approvedPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Rejected</p><p className="stat-card__value">{stats.rejectedPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Customers</p><p className="stat-card__value">{stats.customers}</p></article>
        </div>
      ) : null}
      <section className="form-panel form-panel--admin-toolbar">
        <div className="admin-tabs" role="tablist">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} type="button" className={`btn btn--sm ${tab === s ? 'btn--primary' : 'btn--outline'}`} onClick={() => setTab(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <div className="table-actions admin-toolbar">
          <button type="button" className="btn btn--outline btn--sm" disabled={loading} onClick={load}>Reload</button>
          <button type="button" className="btn btn--danger btn--sm" onClick={async () => { await logout(); nav('/login') }}>Sign out</button>
        </div>
        {loading ? <p className="form-hint">Loading…</p> : null}
        {error ? <p className="form-hint" role="alert">{error}</p> : null}
        {!loading && !list.length ? <p className="form-hint admin-empty-msg">No {tab} pharmacies.</p> : null}
        <div className="card-grid card-grid--medicines">
          {list.map((p) => (
            <article className="form-panel pharmacy-order-card" key={p.id}>
              <h2>{p.name}</h2>
              <p className="form-hint">{p.email}</p>
              {p.location ? <p className="form-hint"><strong>Location:</strong> {p.location}</p> : <p className="form-hint">No location yet</p>}
              {p.hasLicense ? <AdminPharmacyLicenseImg userId={p.id} token={token} /> : <p className="form-hint">No licence uploaded</p>}
              {tab === 'pending' ? (
                <div className="table-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn--primary btn--sm" disabled={busyId === p.id} onClick={() => run(adminApi.approvePharmacy, p.id)}>Approve</button>
                  <button type="button" className="btn btn--danger btn--sm btn--danger-solid" disabled={busyId === p.id} onClick={() => run(adminApi.rejectPharmacy, p.id)}>Reject</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const { token, currentUser } = useAuth()
  const { notify } = useCart()
  const [medicines, setMedicines] = useState([])
  const [publicLoading, setPublicLoading] = useState(true)
  const [publicError, setPublicError] = useState('')
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [weeklyTransactions, setWeeklyTransactions] = useState([])
  const activeOrdersCount = orders.filter((o) => !['approved', 'rejected'].includes(o.status)).length

  const loadPublic = async () => {
    setPublicLoading(true)
    setPublicError('')
    try {
      const d = await medicineApi.list()
      const safeMedicines = (d.medicines || [])
        .filter((m) => Number(m.quantity) > 0)
        .map((m) => ({
          ...m,
          name: m.name || 'Unknown medicine',
          genericName: m.genericName || '',
          pharmacyName: m.pharmacyName || 'Unknown pharmacy',
          pharmacyLocation: m.pharmacyLocation || '',
          pharmacyLat: m.pharmacyLat ?? null,
          pharmacyLng: m.pharmacyLng ?? null,
          price: Number(m.price) || 0,
          quantity: Number(m.quantity) || 0,
        }))
      setMedicines(safeMedicines)
    } catch {
      setMedicines([])
      setPublicError('Could not load medicines.')
    } finally {
      setPublicLoading(false)
    }
  }
  const loadInventory = async () => {
    if (!token || currentUser?.role !== 'pharmacy') return setInventory([])
    if (currentUser?.pharmacyApprovalStatus && currentUser.pharmacyApprovalStatus !== 'approved') return setInventory([])
    try {
      const d = await medicineApi.listMine(token)
      setInventory(d.medicines || [])
    } catch {
      setInventory([])
    }
  }
  const loadOrders = async () => {
    if (!token || currentUser?.role !== 'pharmacy') return setOrders([])
    if (currentUser?.pharmacyApprovalStatus && currentUser.pharmacyApprovalStatus !== 'approved') return setOrders([])
    try {
      const d = await orderApi.listPharmacy(token)
      setOrders(d.orders || [])
    } catch {
      setOrders([])
    }
  }
  const loadWeeklyTransactions = async () => {
    if (!token || currentUser?.role !== 'pharmacy') return setWeeklyTransactions([])
    if (currentUser?.pharmacyApprovalStatus && currentUser.pharmacyApprovalStatus !== 'approved') return setWeeklyTransactions([])
    try {
      const d = await orderApi.listPharmacyTransactions(token, 'week')
      setWeeklyTransactions(d.transactions || [])
    } catch {
      setWeeklyTransactions([])
    }
  }

  useEffect(() => { loadPublic() }, [])
  useEffect(() => { loadInventory(); loadOrders(); loadWeeklyTransactions() }, [token, currentUser?.role, currentUser?.pharmacyApprovalStatus])
  useEffect(() => {
    if (!token || currentUser?.role !== 'pharmacy') return undefined
    if (currentUser?.pharmacyApprovalStatus && currentUser.pharmacyApprovalStatus !== 'approved') return undefined
    const i = setInterval(() => { loadOrders(); loadWeeklyTransactions() }, 5000)
    return () => clearInterval(i)
  }, [token, currentUser?.role, currentUser?.pharmacyApprovalStatus])

  const addMed = async (p) => {
    try {
      await medicineApi.create(p, token)
      await Promise.all([loadPublic(), loadInventory()])
      notify('Medicine added successfully.')
      return true
    } catch (e) {
      notify(e.message || 'Failed to add medicine.')
      return false
    }
  }
  const updMed = async (id, f, v) => { await medicineApi.update(id, { [f]: v }, token); await Promise.all([loadPublic(), loadInventory()]) }
  const delMed = async (id) => { await medicineApi.remove(id, token); await Promise.all([loadPublic(), loadInventory()]) }
  const approve = async (id) => {
    try {
      await orderApi.approveForPharmacy(id, token)
      notify('Order approved successfully.')
      await Promise.all([loadOrders(), loadPublic(), loadInventory(), loadWeeklyTransactions()])
    } catch (e) {
      notify(e.message || 'Failed to approve order.')
    }
  }
  const reject = async (id) => {
    try {
      await orderApi.rejectForPharmacy(id, token)
      notify('Order declined successfully.')
      await Promise.all([loadOrders(), loadPublic(), loadInventory(), loadWeeklyTransactions()])
    } catch (e) {
      notify(e.message || 'Failed to decline order.')
    }
  }

  return (
    <Routes>
      <Route path="/" element={<PublicLayout><Home medicines={medicines} loading={publicLoading} error={publicError} /></PublicLayout>} />
      <Route path="/search" element={<PublicLayout><Search medicines={medicines} loading={publicLoading} error={publicError} /></PublicLayout>} />
      <Route path="/pharmacies" element={<PublicLayout><Pharmacies medicines={medicines} loading={publicLoading} error={publicError} /></PublicLayout>} />
      <Route path="/cart" element={<CustomerRoute><PublicLayout><CartPage /></PublicLayout></CustomerRoute>} />
      <Route path="/profile" element={<CustomerRoute><PublicLayout><Profile /></PublicLayout></CustomerRoute>} />
      <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
      <Route path="/terms" element={<PublicLayout><TermsPage /></PublicLayout>} />
      <Route path="/payment/callback" element={<CustomerRoute><PublicLayout><PaymentCallback /></PublicLayout></CustomerRoute>} />
      <Route path="/pharmacy-pending" element={<PharmacyPendingRoute><PublicLayout><PharmacyPendingPage /></PublicLayout></PharmacyPendingRoute>} />
      <Route path="/pharmacy-location" element={<PharmacyLocationRoute><PublicLayout><PharmacyLocationPage /></PublicLayout></PharmacyLocationRoute>} />
      <Route path="/admin" element={<AdminRoute><PublicLayout><AdminPage /></PublicLayout></AdminRoute>} />

      <Route path="/pharmacy-dashboard" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<DashboardHome inventory={inventory} orders={orders} weeklyTransactions={weeklyTransactions} />} /></Route>
      <Route path="/pharmacy-orders" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<PharmacyOrders orders={orders} onApprove={approve} onReject={reject} />} /></Route>
      <Route path="/inventory" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Inventory inventory={inventory} onUpdate={updMed} onDelete={delMed} />} /></Route>
      <Route path="/add-medicine" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<AddMedicine onAdd={addMed} />} /></Route>
      <Route path="/pharmacy-profile" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Profile />} /></Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
