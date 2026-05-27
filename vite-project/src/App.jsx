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
  const featured = (medicines || []).slice(0, 6)
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
      <section className="form-panel form-panel--wide">
        <header className="section-header section-header--compact">
          <h2>Available medicines</h2>
          <Link to="/search" className="btn btn--outline btn--sm">View all</Link>
        </header>
        {loading ? <p className="form-hint">Loading medicines...</p> : null}
        {!loading && error ? <p className="form-hint" role="alert">{error}</p> : null}
        {!loading && !error && featured.length === 0 ? <p className="form-hint">No medicines available right now.</p> : null}
        {!loading && !error && featured.length > 0 ? (
          <div className="card-grid card-grid--medicines">
            {featured.map((m) => <MedicineCard key={m._id || m.id} medicine={m} onAddToCart={addToCart} />)}
          </div>
        ) : null}
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
  const { cartItems, cartStatus, orderHistory, removeFromCart, updateQuantity, checkout, checkoutLoading, cancelPendingOrder, cancelLoading, checkPendingOrderStatus, updateDeliveryLocation, subtotal } = useCart()
  const [useChapa, setUseChapa] = useState(false)
  const [wantsDelivery, setWantsDelivery] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const [prescriptionFile, setPrescriptionFile] = useState(null)
  const [deliveryLat, setDeliveryLat] = useState('')
  const [deliveryLng, setDeliveryLng] = useState('')
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
    if (!useChapa && !receiptFile) {
      window.alert('You cannot continue. Please upload a receipt image first.')
      return
    }
    const result = await checkout(
      useChapa ? 'chapa' : 'none',
      receiptFile,
      prescriptionFile,
      wantsDelivery,
      { chapaAccount, chapaDemoPassword },
    )
    if (result.ok) {
      setReceiptFile(null)
      setPrescriptionFile(null)
      setDeliveryLat('')
      setDeliveryLng('')
      setChapaAccount('')
      setChapaDemoPassword('')
    }
  }
  const fillDeliveryLocation = () => {
    if (!navigator.geolocation) return window.alert('Location is not supported in this browser.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryLat(String(pos.coords.latitude))
        setDeliveryLng(String(pos.coords.longitude))
      },
      () => window.alert('Could not get your location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const submitDeliveryLocation = async () => {
    const orderId = orderHistory?.orderId
    if (!orderId) return window.alert('No approved order found for delivery update.')
    const lat = Number(deliveryLat)
    const lng = Number(deliveryLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      window.alert('Please enter valid latitude and longitude before continuing.')
      return
    }
    await updateDeliveryLocation(orderId, lat, lng)
  }
  const handleCancelWaitingOrder = async () => {
    if (!window.confirm('Cancel this waiting order? You can edit your cart again after cancelling.')) return
    await cancelPendingOrder()
  }

  // Collect unique pharmacies with their account numbers from cart items
  const pharmacyAccounts = useMemo(() => {
    const seen = new Map()
    for (const item of cartItems) {
      const key = item.pharmacyName || 'Unknown pharmacy'
      if (!seen.has(key)) {
        seen.set(key, item.pharmacyAccountNumber || '')
      }
    }
    return [...seen.entries()].map(([name, accountNumber]) => ({ name, accountNumber }))
  }, [cartItems])

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
            {useChapa ? <p className="form-hint">Chapa is demo-only. It does not connect to the real Chapa service.</p> : <p className="form-hint">Chapa is off. Transfer the total to the pharmacy account below, then upload your receipt.</p>}
            <label className="terms-block__check" htmlFor="wants-delivery" style={{ marginTop: '0.6rem' }}>
              <input id="wants-delivery" type="checkbox" checked={wantsDelivery} onChange={(e) => setWantsDelivery(e.target.checked)} />
              <span>Need delivery service</span>
            </label>
            <p className="form-hint">{wantsDelivery ? 'Delivery enabled (50 ETB). After approval you must provide your live location.' : 'Delivery disabled. Pick up medicine from pharmacy.'}</p>
          </div>

          {/* Show pharmacy account numbers when paying manually */}
          {!useChapa && cartItems.length > 0 ? (
            <div className="pharmacy-accounts-box">
              <p className="pharmacy-accounts-box__title">📋 Pharmacy payment details</p>
              {pharmacyAccounts.map(({ name, accountNumber }) => (
                <div key={name} className="pharmacy-accounts-box__row">
                  <span className="pharmacy-accounts-box__name">{name}</span>
                  {accountNumber
                    ? <span className="pharmacy-accounts-box__number">{accountNumber}</span>
                    : <span className="pharmacy-accounts-box__missing">No account number set — contact pharmacy directly</span>}
                </div>
              ))}
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>Transfer the total amount to the account above, then upload your receipt photo below.</p>
            </div>
          ) : null}

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
            <FileInput id="receipt-photo" label="Receipt photo" required fileName={receiptFile?.name} onChange={setReceiptFile} hint="Upload a clear photo of your payment receipt." />
          )}
          <FileInput
            id="prescription-photo"
            label="Prescription image (optional)"
            fileName={prescriptionFile?.name}
            onChange={setPrescriptionFile}
            hint="Optional: upload a doctor prescription image for pharmacy review."
          />
          <div className="cart-summary__row"><span>Subtotal</span><span>{subtotal} ETB</span></div>
          <div className="cart-summary__row"><span>Delivery</span><span>{wantsDelivery && cartItems.length ? 50 : 0} ETB</span></div>
          <div className="cart-summary__row cart-summary__row--total"><span>Total price</span><span>{subtotal + (wantsDelivery && cartItems.length ? 50 : 0)} ETB</span></div>
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
          {Array.isArray(orderHistory.rejectedReasons) && orderHistory.rejectedReasons.length ? (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <p className="form-hint" style={{ marginBottom: '0.35rem' }}><strong>Rejection reason(s):</strong></p>
              {orderHistory.rejectedReasons.map((reason) => (
                <p key={reason} className="form-hint">- {reason}</p>
              ))}
            </div>
          ) : null}
          {cartStatus === 'waiting' && orderHistory.pending > 0 && orderHistory.approved === 0 ? <button type="button" className="btn btn--danger btn--block" disabled={cancelLoading} onClick={handleCancelWaitingOrder}>{cancelLoading ? 'Cancelling...' : 'Cancel waiting order'}</button> : null}
          {cartStatus === 'waiting' && orderHistory.approved > 0 ? <p className="form-hint">This order has pharmacy approval and can no longer be cancelled.</p> : null}
          {orderHistory.status === 'approved' && orderHistory.wantsDelivery && !hasCoords(orderHistory.deliveryLocationLat, orderHistory.deliveryLocationLng) ? (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <p className="form-hint"><strong>Delivery is enabled.</strong> You must provide your location to continue.</p>
              <div className="table-actions">
                <button type="button" className="btn btn--outline btn--sm" onClick={fillDeliveryLocation}>Use current location</button>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label>Latitude</label><input value={deliveryLat} onChange={(e) => setDeliveryLat(e.target.value)} placeholder="e.g. 7.06205" /></div>
                <div className="form-group"><label>Longitude</label><input value={deliveryLng} onChange={(e) => setDeliveryLng(e.target.value)} placeholder="e.g. 38.47635" /></div>
              </div>
              <button type="button" className="btn btn--primary btn--sm" onClick={submitDeliveryLocation}>Save delivery location</button>
            </div>
          ) : null}
          {orderHistory.status === 'approved' && orderHistory.wantsDelivery && hasCoords(orderHistory.deliveryLocationLat, orderHistory.deliveryLocationLng) ? (
            <p className="form-hint">Delivery location saved: {Number(orderHistory.deliveryLocationLat).toFixed(5)}, {Number(orderHistory.deliveryLocationLng).toFixed(5)}</p>
          ) : null}
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
                {showPassword ? 'Hide' : 'Show'}
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
    if (form.role === 'pharmacy' && !licenseFile) {
      window.alert('You cannot continue. Please upload a pharmacy licence image.')
      return setErr('Please upload a clear photo of your pharmacy licence.')
    }
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
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="form-hint form-hint--field">{strongPasswordHint}</p>
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm-password">Confirm password</label>
            <div className="input-password-wrap">
              <input id="reg-confirm-password" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              <button type="button" className="input-password-toggle" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm((v) => !v)}>
                {showConfirm ? 'Hide' : 'Show'}
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
            <FileInput id="reg-licence" label="Pharmacy licence (photo)" required fileName={licenseFile?.name} onChange={setLicenseFile} hint="Only administrators can view your licence photo. Max size: 2MB." />
          ) : null}
          <FileInput id="reg-photo" label="Profile picture (optional)" fileName={file?.name} onChange={setFile} hint="Max size: 2MB." />
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
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').trim()

const apiOrigin = (() => {
  try {
    if (!/^https?:\/\//i.test(apiBaseUrl)) return null
    return new URL(apiBaseUrl).origin
  } catch {
    return null
  }
})()

/**
 * Resolves an image src returned by the backend into something the browser can fetch.
 *
 * The backend returns absolute URLs like http://localhost:5000/uploads/profile-xxx.jpg
 * (controlled by PUBLIC_ORIGIN in backend/.env).
 *
 * In local dev we strip the origin so the path becomes /uploads/xxx which the
 * Vite proxy forwards to localhost:5000 — this avoids direct cross-origin requests
 * and works even if PUBLIC_ORIGIN is wrong.
 *
 * In production (Vercel) the backend returns its own origin, which is the same
 * domain as the frontend, so /uploads/xxx resolves correctly there too.
 *
 * CDN URLs (flaticon etc.) are kept as-is.
 */
const uploadImageSrc = (src) => {
  if (!src) return ''
  const s = String(src)
  // CDN / external image — keep as-is
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s)
      if (url.pathname.startsWith('/uploads/')) {
        const sameOrigin = typeof window !== 'undefined' && url.origin === window.location.origin
        const sameApiOrigin = apiOrigin && url.origin === apiOrigin
        // For local dev proxy or same-origin deploys, use relative path.
        if (sameOrigin || sameApiOrigin || /localhost|127\.0\.0\.1/i.test(url.hostname)) return url.pathname
      }
    } catch {
      // malformed URL — return as-is
    }
    return s
  }
  if (s.startsWith('/')) return s
  return `/${s}`
}
const profileImageSrc = (src) => uploadImageSrc(src) || fallbackProfileImage

function Profile() {
  const { currentUser, authLoading, refreshProfile, updateProfile, updatePharmacyLicense, logout } = useAuth()
  const nav = useNavigate()
  const isPharmacy = currentUser?.role === 'pharmacy'

  // form state — always mirrors currentUser when not editing
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [locationLat, setLocationLat] = useState('')
  const [locationLng, setLocationLng] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [file, setFile] = useState(null)
  const [licenseFile, setLicenseFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [imgKey, setImgKey] = useState(0) // bump to force <img> reload after upload

  // Sync form fields from server data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return
    setName(currentUser.name || '')
    setLocation(currentUser.location || '')
    setLocationLat(currentUser.locationLat ?? '')
    setLocationLng(currentUser.locationLng ?? '')
    setAccountNumber(currentUser.accountNumber || '')
    setImgKey((k) => k + 1) // force image element to re-fetch new URL
  }, [
    currentUser?.name,
    currentUser?.location,
    currentUser?.locationLat,
    currentUser?.locationLng,
    currentUser?.accountNumber,
    currentUser?.profileImage,
  ])

  // Load fresh data from server on mount
  useEffect(() => { refreshProfile() }, [])

  if (authLoading) return <section className="form-panel form-panel--wide"><p className="form-hint">Loading profile...</p></section>
  if (!currentUser) return <section className="form-panel form-panel--wide"><p className="form-hint">Profile not found. Please login again.</p></section>

  const profileIncomplete = isPharmacy && (!currentUser.name?.trim() || !currentUser.location?.trim())

  const openEdit = () => {
    // Reset form to current server values before opening
    setName(currentUser.name || '')
    setLocation(currentUser.location || '')
    setLocationLat(currentUser.locationLat ?? '')
    setLocationLng(currentUser.locationLng ?? '')
    setAccountNumber(currentUser.accountNumber || '')
    setFile(null)
    setLicenseFile(null)
    setMsg('')
    setEdit(true)
  }

  const cancelEdit = () => {
    setEdit(false)
    setMsg('')
    setFile(null)
    setLicenseFile(null)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const r = await updateProfile({
      name: name.trim(),
      profileFile: file,
      location: isPharmacy ? location : undefined,
      locationLat: isPharmacy ? locationLat : undefined,
      locationLng: isPharmacy ? locationLng : undefined,
      accountNumber: isPharmacy ? accountNumber : undefined,
    })
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
      setMsg(lr.message || 'Profile saved.')
    } else {
      setMsg('Profile saved.')
    }
    setFile(null)
    setLicenseFile(null)
    setSaving(false)
    // Fetch fresh data from server FIRST so the view shows updated values immediately
    await refreshProfile()
    // Only close edit mode after fresh data is in state
    setEdit(false)
  }

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) return setMsg('Location is not supported in this browser.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude)
        setLocationLng(pos.coords.longitude)
        setMsg('GPS coordinates captured.')
      },
      () => setMsg('Could not get location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const avatarSrc = profileImageSrc(currentUser.profileImage)

  return (
    <section className="form-panel form-panel--wide profile-card">
      {/* Incomplete profile warning */}
      {profileIncomplete && !edit ? (
        <div className="profile-incomplete-banner" role="alert">
          <span>⚠️ Profile incomplete — customers cannot checkout until you set your <strong>pharmacy name</strong>, <strong>location</strong>, and <strong>account number</strong>.</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={openEdit}>Complete profile ✎</button>
        </div>
      ) : null}

      {/* Header: avatar + summary */}
      <div className="profile-card__header">
        <div className="profile-avatar-wrap">
          <img
            key={imgKey}
            className="profile-avatar"
            src={avatarSrc}
            alt="Profile"
            onError={(e) => { e.currentTarget.src = fallbackProfileImage }}
          />
          <button
            type="button"
            className="profile-avatar-edit"
            aria-label={edit ? 'Cancel editing' : 'Edit profile'}
            title={edit ? 'Cancel' : 'Edit profile'}
            onClick={edit ? cancelEdit : openEdit}
          >✎</button>
        </div>
        <div className="profile-card__info">
          <h2 className="profile-card__name">{currentUser.name || '—'}</h2>
          <p className="form-hint">{currentUser.email}</p>
          {isPharmacy ? <p className="form-hint">Status: <strong>{currentUser.pharmacyApprovalStatus}</strong></p> : null}
        </div>
      </div>

      {/* View mode — show all saved values clearly */}
      {!edit ? (
        <dl className="profile-view">
          <div className="profile-view__row">
            <dt>{isPharmacy ? 'Pharmacy name' : 'Full name'}</dt>
            <dd>{currentUser.name || <em>Not set</em>}</dd>
          </div>
          {isPharmacy ? (
            <>
              <div className="profile-view__row">
                <dt>Location</dt>
                <dd>{currentUser.location || <em>Not set</em>}</dd>
              </div>
              {hasCoords(currentUser.locationLat, currentUser.locationLng) ? (
                <div className="profile-view__row">
                  <dt>GPS</dt>
                  <dd>{Number(currentUser.locationLat).toFixed(5)}, {Number(currentUser.locationLng).toFixed(5)}</dd>
                </div>
              ) : null}
              <div className="profile-view__row">
                <dt>Account number</dt>
                <dd>{currentUser.accountNumber || <em>Not set — customers need this to send payment</em>}</dd>
              </div>
            </>
          ) : null}
          <div className="profile-view__row">
            <dt>Profile picture</dt>
            <dd><img src={avatarSrc} key={imgKey} alt="Profile" className="profile-view__thumb" onError={(e) => { e.currentTarget.src = fallbackProfileImage }} /></dd>
          </div>
        </dl>
      ) : null}

      {/* Edit form */}
      {edit ? (
        <form onSubmit={save} className="profile-edit-form">
          <div className="form-group">
            <label htmlFor="profile-name">{isPharmacy ? 'Pharmacy name' : 'Full name'}</label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={isPharmacy ? 'e.g. Hawassa Central Pharmacy' : 'Your full name'}
            />
            {isPharmacy ? <p className="form-hint form-hint--field">This name appears on all your medicines and orders.</p> : null}
          </div>

          {isPharmacy ? (
            <>
              <div className="form-group">
                <label htmlFor="profile-location">Pharmacy location (Hawassa)</label>
                <textarea
                  id="profile-location"
                  rows={3}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Tabor sub-city, near Hawassa University"
                />
                <button type="button" className="btn btn--outline btn--sm" style={{ marginTop: '0.5rem' }} onClick={fillCurrentLocation}>
                  📍 Use current GPS location
                </button>
                {hasCoords(locationLat, locationLng)
                  ? <p className="form-hint">GPS: {Number(locationLat).toFixed(5)}, {Number(locationLng).toFixed(5)}</p>
                  : <p className="form-hint">GPS coordinates help customers find the nearest pharmacy.</p>}
              </div>

              <div className="form-group">
                <label htmlFor="profile-account">Bank / account number</label>
                <input
                  id="profile-account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. CBE 1000123456789"
                />
                <p className="form-hint form-hint--field">Customers who pay manually need this to send money before uploading a receipt.</p>
              </div>
            </>
          ) : null}

          <FileInput label="Profile picture" fileName={file?.name} onChange={setFile} />

          {isPharmacy ? (
            <FileInput
              label="Replace licence photo"
              fileName={licenseFile?.name}
              onChange={setLicenseFile}
              hint="Licence photos are only visible to administrators. Updating will require re-approval."
            />
          ) : null}

          <div className="profile-form-actions">
            <button className="btn btn--primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
            <button type="button" className="btn btn--outline" disabled={saving} onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {msg ? <p className="form-hint profile-save-msg" role="status">{msg}</p> : null}

      <div className="profile-signout-wrap">
        <button
          type="button"
          className="btn btn--ghost btn--sm profile-signout-btn"
          onClick={async () => { await logout(); nav('/login') }}
        >
          Sign out
        </button>
      </div>
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

function DashboardHome({ inventory, orders, weeklyTransactions, onDelete }) {
  const { currentUser } = useAuth()
  const nav = useNavigate()
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const approvedOrders = orders.filter((o) => o.status === 'approved').length
  const declinedOrders = orders.filter((o) => o.status === 'rejected').length
  const weeklyTransactionTotal = weeklyTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  const expiringMedicines = inventory
    .filter((m) => {
      if (!m.expiry) return false
      const expiry = new Date(m.expiry)
      return !Number.isNaN(expiry.getTime()) && expiry <= soon
    })
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))

  const expiredCount = expiringMedicines.filter((m) => m.expiry < today).length
  const profileIncomplete = !currentUser?.name?.trim() || !currentUser?.location?.trim()

  return (
    <>
      <h1 className="dash-title">Dashboard</h1>

      {profileIncomplete ? (
        <div className="profile-incomplete-banner" role="alert">
          <span>⚠️ Your pharmacy profile is incomplete — customers cannot checkout your medicines until you set your <strong>pharmacy name</strong> and <strong>location</strong>.</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => nav('/pharmacy-profile')}>Complete profile ✎</button>
        </div>
      ) : null}

      {expiredCount > 0 ? (
        <div className="profile-incomplete-banner" role="alert" style={{ borderColor: '#b91c1c' }}>
          <span>🚫 You have <strong>{expiredCount}</strong> expired medicine{expiredCount > 1 ? 's' : ''} in your inventory. Expired medicines are hidden from customers. Please remove them below.</span>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => document.getElementById('expiry-alerts-section')?.scrollIntoView({ behavior: 'smooth' })}>View expired ↓</button>
        </div>
      ) : null}

      <div className="stat-grid">
        <article className="stat-card"><p className="stat-card__label">Total medicines</p><p className="stat-card__value">{inventory.length}</p></article>
        <article className="stat-card"><p className="stat-card__label">Pending orders</p><p className="stat-card__value">{pendingOrders}</p></article>
        <article className="stat-card"><p className="stat-card__label">Approved orders</p><p className="stat-card__value">{approvedOrders}</p></article>
        <article className="stat-card"><p className="stat-card__label">Declined orders</p><p className="stat-card__value">{declinedOrders}</p></article>
        <article className="stat-card"><p className="stat-card__label">Low stock (&lt; 10)</p><p className="stat-card__value">{inventory.filter((m) => Number(m.quantity) < 10).length}</p></article>
        <article className="stat-card"><p className="stat-card__label">This week transactions</p><p className="stat-card__value">{weeklyTransactions.length}</p><p className="form-hint">{weeklyTransactionTotal} ETB</p></article>
        {expiredCount > 0 ? <article className="stat-card stat-card--danger"><p className="stat-card__label">🚫 Expired</p><p className="stat-card__value">{expiredCount}</p></article> : null}
      </div>

      <section className="form-panel form-panel--full cart-history">
        <h2>This week transaction history</h2>
        <TransactionList transactions={weeklyTransactions} />
      </section>

      <section className="form-panel form-panel--full cart-history" id="expiry-alerts-section">
        <h2>Expiry alerts</h2>
        <p className="form-hint">Expired medicines are automatically hidden from customers. Remove them to keep your inventory clean.</p>
        {!expiringMedicines.length ? <p className="form-hint">No medicines expiring in the next 30 days. ✓</p> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Medicine</th><th>Quantity</th><th>Expiry date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {expiringMedicines.map((m) => {
                  const expired = m.expiry < today
                  return (
                    <tr key={m._id || m.id} className={expired ? 'admin-expired-row' : ''}>
                      <th scope="row">{m.name}</th>
                      <td>{m.quantity}</td>
                      <td style={expired ? { color: '#b91c1c', fontWeight: 700 } : {}}>{m.expiry}</td>
                      <td>
                        <span className={`order-item-status order-item-status--${expired ? 'rejected' : 'pending'}`}>
                          {expired ? 'Expired' : 'Expiring soon'}
                        </span>
                      </td>
                      <td>
                        {expired ? (
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => {
                              if (window.confirm(`Remove "${m.name}" from your inventory?`)) onDelete(m._id || m.id)
                            }}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => nav('/inventory')}
                          >
                            Update
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function AddMedicine({ onAdd }) {
  const { currentUser } = useAuth()
  const initial = { name: '', genericName: '', pharmacyName: currentUser?.name || '', price: '', quantity: '', expiry: '' }
  const [f, setF] = useState(initial)
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onAdd({ ...f, price: Number(f.price), quantity: Number(f.quantity) })
    setSaving(false)
    if (ok) setF({ ...initial, pharmacyName: currentUser?.name || '' })
  }
  return <><h1 className="dash-title">Add medicine</h1><section className="form-panel form-panel--full"><form onSubmit={submit}><div className="form-grid-2"><div className="form-group"><label>Medicine name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div><div className="form-group"><label>Generic name</label><input value={f.genericName} onChange={(e) => setF({ ...f, genericName: e.target.value })} required /></div><div className="form-group"><label>Pharmacy name</label><input value={f.pharmacyName} onChange={(e) => setF({ ...f, pharmacyName: e.target.value })} required /></div><div className="form-group"><label>Price</label><input type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></div><div className="form-group"><label>Quantity</label><input type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required /></div><div className="form-group"><label>Expiry date</label><input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} required /></div></div><button className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save medicine'}</button></form></section></>
}

function Inventory({ inventory, onUpdate, onDelete }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <h1 className="dash-title">Inventory management</h1>
      {inventory.some((m) => m.expiry && m.expiry < today) ? (
        <div className="profile-incomplete-banner" role="alert" style={{ borderColor: '#b91c1c', marginBottom: '1rem' }}>
          <span>🚫 Some medicines below have <strong>expired</strong> and are hidden from customers. Remove them to keep your inventory accurate.</span>
        </div>
      ) : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine name</th>
              <th>Price (ETB)</th>
              <th>Quantity</th>
              <th>Expiry date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((m) => {
              const expired = m.expiry && m.expiry < today
              const expiringSoon = m.expiry && !expired && m.expiry <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
              return (
                <tr key={m._id} className={expired ? 'admin-expired-row' : ''}>
                  <th scope="row">{m.name}</th>
                  <td>
                    <input
                      type="number"
                      value={m.price}
                      onChange={(e) => onUpdate(m._id, 'price', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={m.quantity}
                      onChange={(e) => onUpdate(m._id, 'quantity', Number(e.target.value))}
                    />
                  </td>
                  <td style={expired ? { color: '#b91c1c', fontWeight: 700 } : expiringSoon ? { color: '#b45309', fontWeight: 600 } : {}}>
                    {m.expiry || '—'}
                  </td>
                  <td>
                    {expired
                      ? <span className="order-item-status order-item-status--rejected">Expired</span>
                      : expiringSoon
                        ? <span className="order-item-status order-item-status--pending">Expiring soon</span>
                        : <span className="order-item-status order-item-status--approved">OK</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          if (window.confirm(`Remove "${m.name}" from inventory?`)) onDelete(m._id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function OrderImage({ src, orderId, label = '📄 Payment receipt', emptyText = 'No image uploaded for this order.' }) {
  const imageSrc = uploadImageSrc(src)
  const [imgError, setImgError] = useState(false)
  if (!imageSrc) return <p className="form-hint order-receipt__missing">{emptyText}</p>
  return (
    <div className="order-receipt">
      <p className="order-receipt__label">{label}</p>
      {!imgError ? (
        <a href={imageSrc} target="_blank" rel="noreferrer" className="order-receipt__link">
          <img
            src={imageSrc}
            alt={`Order image for ${String(orderId).slice(-6)}`}
            className="order-receipt__img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <span className="order-receipt__view">Click to view full size ↗</span>
        </a>
      ) : (
        <a href={imageSrc} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">
          Open image ↗
        </a>
      )}
    </div>
  )
}

function PharmacyOrders({ orders, onApprove, onReject }) {
  const [busy, setBusy] = useState('')
  const [dismissedOrderIds, setDismissedOrderIds] = useState([])
  const visibleOrders = orders.filter((o) => !dismissedOrderIds.includes(o.id))
  const pendingOrdersCount = visibleOrders.filter((o) => o.items.some((item) => item.status === 'pending')).length
  const dismissOrder = (id) => setDismissedOrderIds((prev) => [...prev, id])
  const run = async (fn, id, ...args) => { setBusy(id); await fn(id, ...args); setBusy('') }
  const handleReject = async (orderId) => {
    const reason = window.prompt('Enter rejection reason for the customer:')
    if (reason == null) return
    if (!String(reason).trim()) return window.alert('Rejection reason is required.')
    await run(onReject, orderId, String(reason).trim())
  }
  return (
    <>
      <h1 className="dash-title">Orders</h1>
      {pendingOrdersCount > 0 ? <p className="form-hint">New orders waiting: <strong>{pendingOrdersCount}</strong></p> : null}
      {!visibleOrders.length ? <p className="form-hint">No orders to show.</p> : null}
      <div className="card-grid card-grid--medicines">
        {visibleOrders.map((o) => {
          const hasPendingItems = o.items.some((item) => item.status === 'pending')
          return (
            <article className="form-panel pharmacy-order-card" key={o.id}>
              <div className="pharmacy-order-card__top">
                <h2>Order #{String(o.id).slice(-6)}</h2>
                {!hasPendingItems ? (
                  <button type="button" className="pharmacy-order-card__close" aria-label="Remove old order" onClick={() => dismissOrder(o.id)}>✕</button>
                ) : null}
              </div>

              <div className="pharmacy-order-card__meta">
                <p><span className="order-meta-label">Status:</span> {o.status}</p>
                <p><span className="order-meta-label">Payment:</span> {o.paymentMethod === 'chapa' ? 'Chapa Demo' : 'Manual transfer'}</p>
                <p><span className="order-meta-label">Delivery:</span> {o.wantsDelivery ? 'On' : 'Off'}</p>
                {o.chapaAccount ? <p><span className="order-meta-label">Chapa account:</span> {o.chapaAccount}</p> : null}
                {o.customer?.name ? <p><span className="order-meta-label">Customer:</span> {o.customer.name}</p> : null}
                {o.customer?.email ? <p><span className="order-meta-label">Email:</span> {o.customer.email}</p> : null}
                {o.wantsDelivery && hasCoords(o.deliveryLocationLat, o.deliveryLocationLng) ? (
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => openDirections(o.deliveryLocationLat, o.deliveryLocationLng, '')}
                  >
                    Redirect to customer location
                  </button>
                ) : null}
              </div>

              <OrderImage src={o.receiptImage || o.receipt} orderId={o.id} label="📄 Payment receipt" emptyText="No receipt uploaded for this order." />
              <OrderImage src={o.prescriptionImage || o.prescription || o.prescriptionPhoto} orderId={o.id} label="🩺 Prescription image" emptyText="No prescription image uploaded." />

              <div className="pharmacy-order-card__items">
                {o.items.map((i) => (
                  <div key={`${i.medicineId}-${i.status}`} className="pharmacy-order-card__item">
                    <span>{i.medicineName}</span>
                    <span>Qty: {i.quantity}</span>
                    <span className={`order-item-status order-item-status--${i.status}`}>{i.status}</span>
                  </div>
                ))}
              </div>

              {hasPendingItems ? (
                <div className="table-actions">
                  <button className="btn btn--primary btn--sm" disabled={busy === o.id} onClick={() => run(onApprove, o.id)}>Approve</button>
                  <button className="btn btn--danger btn--sm btn--danger-solid" disabled={busy === o.id} onClick={() => handleReject(o.id)}>Decline</button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
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
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: '1.5rem' }} onClick={async () => { await logout(); nav('/login') }}>Sign out</button>
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

  // main section tabs
  const [section, setSection] = useState('pharmacies')

  // --- pharmacies tab ---
  const [pharmTab, setPharmTab] = useState('pending')
  const [stats, setStats] = useState(null)
  const [pharmList, setPharmList] = useState([])
  const [pharmLoading, setPharmLoading] = useState(true)
  const [pharmError, setPharmError] = useState('')
  const [busyId, setBusyId] = useState('')

  // --- accounts tab ---
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')

  // --- transactions tab ---
  const [txns, setTxns] = useState([])
  const [txnsLoading, setTxnsLoading] = useState(false)
  const [txnsError, setTxnsError] = useState('')

  // --- expired alerts tab ---
  const [expiredAlerts, setExpiredAlerts] = useState([])
  const [reAddAlerts, setReAddAlerts] = useState([])
  const [expiredMeds, setExpiredMeds] = useState([])
  const [expiredLoading, setExpiredLoading] = useState(false)
  const [expiredError, setExpiredError] = useState('')

  const loadPharmacies = async () => {
    if (!token) return
    setPharmLoading(true)
    setPharmError('')
    const [statsResult, listResult] = await Promise.allSettled([
      adminApi.stats(token),
      adminApi.listPharmacies(pharmTab, token),
    ])

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.stats || null)
    }

    if (listResult.status === 'fulfilled') {
      setPharmList(listResult.value.pharmacies || [])
      if (statsResult.status === 'rejected') {
        setPharmError('Pharmacy list loaded, but stats could not be refreshed.')
      }
    } else {
      setPharmList([])
      setPharmError(listResult.reason?.message || `Failed to reload ${pharmTab} pharmacies.`)
    }

    setPharmLoading(false)
  }

  const loadAccounts = async () => {
    if (!token) return
    setAccountsLoading(true)
    setAccountsError('')
    try {
      const res = await adminApi.listPharmaciesWithAccounts(token)
      setAccounts(res.pharmacies || [])
    } catch (e) {
      setAccountsError(e.message || 'Could not load accounts.')
    } finally {
      setAccountsLoading(false)
    }
  }

  const loadTransactions = async () => {
    if (!token) return
    setTxnsLoading(true)
    setTxnsError('')
    try {
      const res = await adminApi.listAllTransactions(token)
      setTxns(res.transactions || [])
    } catch (e) {
      setTxnsError(e.message || 'Could not load transactions.')
    } finally {
      setTxnsLoading(false)
    }
  }

  const loadExpired = async () => {
    if (!token) return
    setExpiredLoading(true)
    setExpiredError('')
    try {
      const [alertsRes, medsRes] = await Promise.all([
        adminApi.listExpiredAlerts(token),
        adminApi.listExpiredMedicines(token),
      ])
      setExpiredAlerts(alertsRes.alerts || [])
      setReAddAlerts(alertsRes.reAddAlerts || [])
      setExpiredMeds(medsRes.medicines || [])
    } catch (e) {
      setExpiredError(e.message || 'Could not load expired data.')
    } finally {
      setExpiredLoading(false)
    }
  }

  useEffect(() => { loadPharmacies() }, [token, pharmTab])
  useEffect(() => { if (section === 'accounts') loadAccounts() }, [token, section])
  useEffect(() => { if (section === 'transactions') loadTransactions() }, [token, section])
  useEffect(() => { if (section === 'expired') loadExpired() }, [token, section])

  const runPharmacy = async (fn, id) => {
    setBusyId(id)
    try {
      await fn(id, token)
      await loadPharmacies()
    } catch (e) {
      setPharmError(e.message || 'Action failed.')
    } finally {
      setBusyId('')
    }
  }

  const dismissAlert = async (id) => {
    try {
      await adminApi.dismissExpiredAlert(id, token)
      setReAddAlerts((prev) => prev.filter((a) => String(a._id) !== String(id)))
    } catch (e) {
      setExpiredError(e.message || 'Could not dismiss alert.')
    }
  }

  const txStatusColor = (s) => ({ completed: '#16a34a', refunded: '#b91c1c', pending: '#b45309' }[s] || '#64748b')

  return (
    <div className="page-inner">
      <header className="page-header">
        <h1>Admin console</h1>
        <p className="form-hint">Manage pharmacies, view transactions, and monitor expired drug alerts.</p>
      </header>

      {/* Stats bar */}
      {stats ? (
        <div className="stat-grid admin-stat-grid">
          <article className="stat-card"><p className="stat-card__label">Pending</p><p className="stat-card__value">{stats.pendingPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Approved</p><p className="stat-card__value">{stats.approvedPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Rejected</p><p className="stat-card__value">{stats.rejectedPharmacies}</p></article>
          <article className="stat-card"><p className="stat-card__label">Customers</p><p className="stat-card__value">{stats.customers}</p></article>
          <article className="stat-card"><p className="stat-card__label">Medicines</p><p className="stat-card__value">{stats.medicines}</p></article>
          <article className="stat-card"><p className="stat-card__label">Orders</p><p className="stat-card__value">{stats.orders}</p></article>
          {stats.expiredMedicines > 0 ? (
            <article className="stat-card stat-card--danger">
              <p className="stat-card__label">⚠️ Expired medicines</p>
              <p className="stat-card__value">{stats.expiredMedicines}</p>
            </article>
          ) : null}
        </div>
      ) : null}

      {/* Section tabs */}
      <div className="admin-section-tabs" role="tablist">
        {[
          { key: 'pharmacies', label: 'Pharmacies' },
          { key: 'accounts', label: 'Pharmacy Accounts' },
          { key: 'transactions', label: 'Transactions' },
          { key: 'expired', label: `⚠️ Expired Alerts${(stats?.expiredMedicines > 0 || reAddAlerts.length > 0) ? ` (${(stats?.expiredMedicines || 0) + reAddAlerts.length})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={`btn btn--sm ${section === key ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => setSection(key)}
          >{label}</button>
        ))}
      </div>

      {/* ── PHARMACIES TAB ── */}
      {section === 'pharmacies' ? (
        <section className="form-panel form-panel--admin-toolbar">
          <div className="admin-tabs" role="tablist">
            {['pending', 'approved', 'rejected'].map((s) => (
              <button key={s} type="button" className={`btn btn--sm ${pharmTab === s ? 'btn--primary' : 'btn--outline'}`} onClick={() => setPharmTab(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button type="button" className="btn btn--outline btn--sm" disabled={pharmLoading} onClick={loadPharmacies}>Reload</button>
          </div>
          {pharmLoading ? <p className="form-hint">Loading…</p> : null}
          {pharmError ? <p className="form-hint" role="alert">{pharmError}</p> : null}
          {!pharmLoading && !pharmList.length ? <p className="form-hint admin-empty-msg">No {pharmTab} pharmacies.</p> : null}
          <div className="card-grid card-grid--medicines">
            {pharmList.map((p) => (
              <article className="form-panel pharmacy-order-card" key={p.id}>
                <h2>{p.name}</h2>
                <p className="form-hint">{p.email}</p>
                {p.location ? <p className="form-hint"><strong>Location:</strong> {p.location}</p> : <p className="form-hint">No location set</p>}
                {p.accountNumber ? <p className="form-hint"><strong>Account:</strong> <code>{p.accountNumber}</code></p> : <p className="form-hint">No account number</p>}
                {p.hasLicense ? <AdminPharmacyLicenseImg userId={p.id} token={token} /> : <p className="form-hint">No licence uploaded</p>}
                {pharmTab === 'pending' ? (
                  <div className="table-actions" style={{ marginTop: '1rem' }}>
                    <button type="button" className="btn btn--primary btn--sm" disabled={busyId === p.id} onClick={() => runPharmacy(adminApi.approvePharmacy, p.id)}>Approve</button>
                    <button type="button" className="btn btn--danger btn--sm btn--danger-solid" disabled={busyId === p.id} onClick={() => runPharmacy(adminApi.rejectPharmacy, p.id)}>Reject</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── PHARMACY ACCOUNTS TAB ── */}
      {section === 'accounts' ? (
        <section className="form-panel">
          <div className="admin-tabs">
            <h2 style={{ margin: 0 }}>Pharmacies with account numbers</h2>
            <button type="button" className="btn btn--outline btn--sm" disabled={accountsLoading} onClick={loadAccounts}>Reload</button>
          </div>
          {accountsLoading ? <p className="form-hint">Loading…</p> : null}
          {accountsError ? <p className="form-hint" role="alert">{accountsError}</p> : null}
          {!accountsLoading && !accounts.length ? <p className="form-hint">No approved pharmacies have set an account number yet.</p> : null}
          {accounts.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Pharmacy name</th><th>Email</th><th>Location</th><th>Account number</th></tr></thead>
                <tbody>
                  {accounts.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{p.name}</th>
                      <td>{p.email}</td>
                      <td>{p.location || '—'}</td>
                      <td><code className="admin-account-code">{p.accountNumber}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── TRANSACTIONS TAB ── */}
      {section === 'transactions' ? (
        <section className="form-panel">
          <div className="admin-tabs">
            <h2 style={{ margin: 0 }}>All transactions</h2>
            <button type="button" className="btn btn--outline btn--sm" disabled={txnsLoading} onClick={loadTransactions}>Reload</button>
          </div>
          {txnsLoading ? <p className="form-hint">Loading…</p> : null}
          {txnsError ? <p className="form-hint" role="alert">{txnsError}</p> : null}
          {!txnsLoading && !txns.length ? <p className="form-hint">No transactions yet.</p> : null}
          {txns.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pharmacy</th>
                    <th>Customer</th>
                    <th>Amount (ETB)</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Order status</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((tx) => (
                    <tr key={tx._id}>
                      <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td>{tx.pharmacy?.name || '—'}<br /><small>{tx.pharmacy?.email || ''}</small></td>
                      <td>{tx.customer?.name || '—'}<br /><small>{tx.customer?.email || ''}</small></td>
                      <td><strong>{Number(tx.amount || 0).toFixed(2)}</strong></td>
                      <td>{tx.type || 'chapa'}</td>
                      <td>
                        <span className="admin-tx-status" style={{ color: txStatusColor(tx.status) }}>
                          {tx.status}
                        </span>
                      </td>
                      <td>{tx.order?.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── EXPIRED ALERTS TAB ── */}
      {section === 'expired' ? (
        <section className="form-panel">
          <div className="admin-tabs">
            <h2 style={{ margin: 0 }}>⚠️ Expired drug alerts</h2>
            <button type="button" className="btn btn--outline btn--sm" disabled={expiredLoading} onClick={loadExpired}>Reload</button>
          </div>
          {expiredLoading ? <p className="form-hint">Loading…</p> : null}
          {expiredError ? <p className="form-hint" role="alert">{expiredError}</p> : null}

          {/* Re-add alerts — pharmacy added a medicine matching a previously expired one */}
          <h3 className="admin-section-heading">
            🔁 Re-added medicines (previously expired)
            {reAddAlerts.length > 0 ? <span className="admin-alert-count">{reAddAlerts.length}</span> : null}
          </h3>
          <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
            These medicines were added by a pharmacy whose previous listing of the same medicine had expired. Review the new expiry date before approving.
          </p>
          {!expiredLoading && !reAddAlerts.length ? <p className="form-hint">No re-add alerts pending.</p> : null}
          {reAddAlerts.length ? (
            <div className="card-grid card-grid--medicines">
              {reAddAlerts.map((alert) => (
                <article className="form-panel admin-alert-card" key={String(alert._id)}>
                  <div className="admin-alert-card__header">
                    <span className="admin-alert-badge">🔁 Re-added after expiry</span>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => dismissAlert(alert._id)}
                    >
                      ✓ Reviewed
                    </button>
                  </div>
                  <p className="form-hint"><strong>Pharmacy:</strong> {alert.pharmacy?.name || '—'} — {alert.pharmacy?.email || ''}</p>
                  <p className="form-hint"><strong>Medicine:</strong> {alert.medicineName}</p>
                  <div className="admin-alert-expiry-row">
                    <span className="admin-alert-expiry-old">Previous expiry: <strong>{alert.previousExpiry || '—'}</strong></span>
                    <span className="admin-alert-expiry-new">New expiry: <strong>{alert.newExpiry || '—'}</strong></span>
                  </div>
                  <p className="form-hint" style={{ marginTop: '0.35rem' }}>Added: {new Date(alert.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          ) : null}

          {/* Currently expired medicines in stock */}
          <h3 className="admin-section-heading" style={{ marginTop: '2rem' }}>Expired medicines currently in stock</h3>
          {!expiredLoading && !expiredMeds.length ? <p className="form-hint">No expired medicines in stock.</p> : null}
          {expiredMeds.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Medicine</th><th>Generic name</th><th>Pharmacy</th><th>Pharmacy email</th><th>Qty</th><th>Expiry date</th></tr></thead>
                <tbody>
                  {expiredMeds.map((m) => (
                    <tr key={m.id} className="admin-expired-row">
                      <th scope="row">{m.name}</th>
                      <td>{m.genericName || '—'}</td>
                      <td>{m.pharmacyName}</td>
                      <td>{m.pharmacyEmail}</td>
                      <td>{m.quantity}</td>
                      <td><strong style={{ color: '#b91c1c' }}>{m.expiry}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Orders that contained expired medicines */}
          <h3 className="admin-section-heading" style={{ marginTop: '2rem' }}>Orders containing expired medicines</h3>
          {!expiredLoading && !expiredAlerts.length ? <p className="form-hint">No orders with expired medicines found.</p> : null}
          {expiredAlerts.length ? (
            <div className="card-grid card-grid--medicines">
              {expiredAlerts.map((alert) => (
                <article className="form-panel admin-alert-card" key={String(alert.orderId)}>
                  <div className="admin-alert-card__header">
                    <span className="admin-alert-badge">⚠️ Expired drug in order</span>
                    <span className="form-hint">#{String(alert.orderId).slice(-6)}</span>
                  </div>
                  <p className="form-hint"><strong>Date:</strong> {new Date(alert.createdAt).toLocaleString()}</p>
                  <p className="form-hint"><strong>Order status:</strong> {alert.orderStatus}</p>
                  {alert.customer ? (
                    <p className="form-hint"><strong>Customer:</strong> {alert.customer.name} — {alert.customer.email}</p>
                  ) : null}
                  <div className="admin-alert-card__items">
                    {alert.expiredItems.map((item, i) => (
                      <div key={i} className="admin-alert-card__item">
                        <span>{item.medicineName}</span>
                        <span className="form-hint">{item.pharmacyName}</span>
                        <span className="form-hint">Qty: {item.quantity}</span>
                        <span style={{ color: '#b91c1c', fontWeight: 700 }}>Expired: {item.expiry}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Sign out — small, at the very bottom */}
      <div className="profile-signout-wrap">
        <button
          type="button"
          className="btn btn--ghost btn--sm profile-signout-btn"
          onClick={async () => { await logout(); nav('/login') }}
        >
          Sign out
        </button>
      </div>
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
          pharmacyAccountNumber: m.pharmacyAccountNumber || m.createdBy?.accountNumber || '',
          expiry: m.expiry || '',
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
  const reject = async (id, rejectionReason) => {
    try {
      await orderApi.rejectForPharmacy(id, token, { rejectionReason })
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

      <Route path="/pharmacy-dashboard" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<DashboardHome inventory={inventory} orders={orders} weeklyTransactions={weeklyTransactions} onDelete={delMed} />} /></Route>
      <Route path="/pharmacy-orders" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<PharmacyOrders orders={orders} onApprove={approve} onReject={reject} />} /></Route>
      <Route path="/inventory" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Inventory inventory={inventory} onUpdate={updMed} onDelete={delMed} />} /></Route>
      <Route path="/add-medicine" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<AddMedicine onAdd={addMed} />} /></Route>
      <Route path="/pharmacy-profile" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Profile />} /></Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
