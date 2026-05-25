import PharmacyTransactionHistoryPage from './PharmacyTransactionHistoryPage'
  <Route path="/pharmacy-transactions/week" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /><PharmacyTransactionHistoryPage period="week" /></PharmacyRoute>} />
  <Route path="/pharmacy-transactions/all" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /><PharmacyTransactionHistoryPage period="" /></PharmacyRoute>} />
import TransactionHistoryPage from './TransactionHistoryPage'
  <Route path="/transactions/week" element={<CustomerRoute><PublicLayout><TransactionHistoryPage period="week" /></PublicLayout></CustomerRoute>} />
  <Route path="/transactions/all" element={<CustomerRoute><PublicLayout><TransactionHistoryPage period="" /></PublicLayout></CustomerRoute>} />
import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CartToast from './components/CartToast'
import SearchBar from './components/SearchBar'
import MedicineCard from './components/MedicineCard'
import PharmacyCard from './components/PharmacyCard'
import CartItem from './components/CartItem'
import { useAuth } from './context/AuthContext'
import { useCart } from './context/CartContext'
import { medicineApi, orderApi, adminApi, fetchAdminLicenseObjectUrl } from './api/client'
import { isStrongPassword, strongPasswordHint } from './utils/passwordPolicy'
import { redirectAfterAuth, pharmacyNeedsLocation } from './utils/authRedirect'
import FileInput from './components/FileInput'
import TermsAgreement from './components/TermsAgreement'
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

function Search({ medicines, loading, error }) {
  const [q, setQ] = useState('')
  const { addToCart } = useCart()
  const filtered = useMemo(() => medicines.filter((m) => `${m.name || ''} ${m.genericName || ''} ${m.pharmacyName || ''}`.toLowerCase().includes(q.toLowerCase())), [q, medicines])
  return (
    <>
      <header className="page-header"><h1>Search medicine</h1></header>
      <form className="search-bar search-bar--wide search-form-spacing" onSubmit={(e) => e.preventDefault()}><SearchBar value={q} onChange={setQ} /><button type="submit" className="btn btn--primary">Search</button></form>
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
  const { cartItems, cartStatus, orderHistory, removeFromCart, updateQuantity, checkout, checkoutLoading, checkPendingOrderStatus, subtotal, delivery, total } = useCart()
  const [paymentMethod, setPaymentMethod] = useState('none')
  useEffect(() => {
    if (cartStatus !== 'waiting') return
    checkPendingOrderStatus()
    const t = setInterval(checkPendingOrderStatus, 5000)
    return () => clearInterval(t)
  }, [cartStatus, checkPendingOrderStatus])

  const handleCheckout = async () => {
    await checkout(paymentMethod)
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
        <aside className="cart-summary"><h2>Order summary</h2><div className="form-group"><label>Payment method</label><div className="radio-group"><label><input type="radio" name="paymentMethod" value="none" checked={paymentMethod === 'none'} onChange={(e) => setPaymentMethod(e.target.value)} /> Checkout request only</label><label><input type="radio" name="paymentMethod" value="chapa" checked={paymentMethod === 'chapa'} onChange={(e) => setPaymentMethod(e.target.value)} /> Pay with Chapa</label></div>{paymentMethod === 'chapa' ? <p className="form-hint">You will be redirected to Chapa for secure payment.</p> : null}</div><div className="cart-summary__row"><span>Subtotal</span><span>{subtotal} ETB</span></div><div className="cart-summary__row"><span>Delivery</span><span>{delivery} ETB</span></div><div className="cart-summary__row cart-summary__row--total"><span>Total price</span><span>{total} ETB</span></div><button type="button" className="btn btn--primary btn--block cart-checkout-spacer" disabled={checkoutLoading || cartStatus === 'waiting' || cartItems.length === 0} onClick={handleCheckout}>{checkoutLoading ? 'Processing' : 'Checkout'}</button></aside>
      </div>
      {orderHistory ? (
        <section className="form-panel cart-history">
          <h2>Recent checkout history</h2>
          <div className="cart-summary__row"><span>Order status</span><span>{orderHistory.status}</span></div>
          <div className="cart-summary__row"><span>Approved items</span><span>{orderHistory.approved}</span></div>
          <div className="cart-summary__row cart-summary__row--declined"><span>Declined items</span><span>{orderHistory.rejected}</span></div>
          <div className="cart-summary__row"><span>Pending items</span><span>{orderHistory.pending}</span></div>
        </section>
      ) : null}
    </>
  )
}

function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
          <div className="form-group"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
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
  const [file, setFile] = useState(null)
  const [licenseFile, setLicenseFile] = useState(null)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const submit = async (e) => {
    e.preventDefault()
    if (!acceptTerms) return setErr('Please accept the terms and conditions.')
    if (!isStrongPassword(form.password)) return setErr(strongPasswordHint)
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
            <input id="reg-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <p className="form-hint form-hint--field">{strongPasswordHint}</p>
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
        } else {
          setStatus('failed')
          setMessage(result.message || 'Payment could not be verified. Please try again.')
        }
      } catch (e) {
        setStatus('error')
        setMessage(e.message || 'Payment verification failed.')
      }
    })()
  }, [location.search, token])

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

function Profile() {
  const { currentUser, authLoading, refreshProfile, updateProfile, updatePharmacyLicense, logout } = useAuth()
  const nav = useNavigate()
  const isPharmacy = currentUser?.role === 'pharmacy'
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(currentUser?.name || '')
  const [location, setLocation] = useState(currentUser?.location || '')
  const [file, setFile] = useState(null)
  const [licenseFile, setLicenseFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { refreshProfile() }, [])
  useEffect(() => {
    setName(currentUser?.name || '')
    setLocation(currentUser?.location || '')
  }, [currentUser?.name, currentUser?.location])
  if (authLoading) return <section className="form-panel form-panel--wide"><p className="form-hint">Loading profile...</p></section>
  if (!currentUser) return <section className="form-panel form-panel--wide"><p className="form-hint">Profile not found. Please login again.</p></section>
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const r = await updateProfile({ name, profileFile: file, location: isPharmacy ? location : undefined })
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
  return (
    <section className="form-panel form-panel--wide profile-card">
      <div className="profile-card__header">
        <div className="profile-avatar-wrap">
          <img className="profile-avatar" src={currentUser.profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} alt="profile" />
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
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    if (!location.trim()) return setErr('Please enter your pharmacy address in Hawassa.')
    setSaving(true)
    const r = await updateProfile({ name: currentUser?.name || '', location: location.trim() })
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
            <textarea id="pharmacy-location" rows={4} value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="Street, sub-city, landmark…" />
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue to dashboard'}</button>
          {err ? <p className="form-hint" role="alert">{err}</p> : null}
        </form>
      </section>
    </div>
  )
}

function PharmacyLayout({ activeOrdersCount }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header site-header--portal"><div className="header-inner header-inner--portal"><p className="site-title"><Link to="/pharmacy-dashboard">E-Pharmacy<span>Pharmacy portal · Hawassa</span></Link></p><div className="portal-header-actions"><Link className="btn btn--outline btn--sm portal-home-link" to="/">Customer site</Link><span className="portal-badge">Active orders {activeOrdersCount}</span></div></div></header>
      <div className="dash-layout"><aside className="dash-sidebar"><input type="checkbox" id="dash-nav" className="dash-nav-checkbox" hidden /><label htmlFor="dash-nav" className="dash-nav-toggle">Menu</label><nav className="dash-nav"><ul><li><NavLink to="/pharmacy-dashboard">Dashboard</NavLink></li><li><NavLink to="/pharmacy-orders">Orders</NavLink></li><li><NavLink to="/inventory">Manage Medicines</NavLink></li><li><NavLink to="/add-medicine">Add Medicine</NavLink></li><li><NavLink to="/pharmacy-profile">Profile</NavLink></li></ul></nav></aside><main className="dash-main" id="main-content"><Outlet /></main></div>
      <CartToast />
      <Footer />
    </>
  )
}

function DashboardHome({ inventory, orders }) {
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const approvedOrders = orders.filter((o) => o.status === 'approved').length
  const declinedOrders = orders.filter((o) => o.status === 'rejected').length
  return (
    <>
      <h1 className="dash-title">Dashboard</h1>
      <div className="stat-grid"><article className="stat-card"><p className="stat-card__label">Total medicines</p><p className="stat-card__value">{inventory.length}</p></article><article className="stat-card"><p className="stat-card__label">Pending orders</p><p className="stat-card__value">{pendingOrders}</p></article><article className="stat-card"><p className="stat-card__label">Approved orders</p><p className="stat-card__value">{approvedOrders}</p></article><article className="stat-card"><p className="stat-card__label">Declined orders</p><p className="stat-card__value">{declinedOrders}</p></article><article className="stat-card"><p className="stat-card__label">Low stock (&lt; 10)</p><p className="stat-card__value">{inventory.filter((m) => Number(m.quantity) < 10).length}</p></article></div>
    </>
  )
}

function AddMedicine({ onAdd }) {
  const [f, setF] = useState({ name: '', genericName: '', pharmacyName: '', price: 0, quantity: 0, expiry: '' })
  return <><h1 className="dash-title">Add medicine</h1><section className="form-panel form-panel--full"><form onSubmit={(e) => { e.preventDefault(); onAdd({ ...f, price: Number(f.price), quantity: Number(f.quantity) }) }}><div className="form-grid-2"><div className="form-group"><label>Medicine name</label><input onChange={(e) => setF({ ...f, name: e.target.value })} required /></div><div className="form-group"><label>Generic name</label><input onChange={(e) => setF({ ...f, genericName: e.target.value })} required /></div><div className="form-group"><label>Pharmacy name</label><input onChange={(e) => setF({ ...f, pharmacyName: e.target.value })} required /></div><div className="form-group"><label>Price</label><input type="number" min="0" onChange={(e) => setF({ ...f, price: e.target.value })} required /></div><div className="form-group"><label>Quantity</label><input type="number" min="0" onChange={(e) => setF({ ...f, quantity: e.target.value })} required /></div><div className="form-group"><label>Expiry date</label><input type="date" onChange={(e) => setF({ ...f, expiry: e.target.value })} required /></div></div><button className="btn btn--primary">Save medicine</button></form></section></>
}

function Inventory({ inventory, onUpdate, onDelete }) {
  return <><h1 className="dash-title">Inventory management</h1><div className="table-scroll"><table className="data-table"><thead><tr><th>Medicine name</th><th>Price (ETB)</th><th>Quantity</th><th>Actions</th></tr></thead><tbody>{inventory.map((m) => <tr key={m._id}><th scope="row">{m.name}</th><td><input type="number" value={m.price} onChange={(e) => onUpdate(m._id, 'price', Number(e.target.value))} /></td><td><input type="number" value={m.quantity} onChange={(e) => onUpdate(m._id, 'quantity', Number(e.target.value))} /></td><td><div className="table-actions"><button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(m._id)}>Delete</button></div></td></tr>)}</tbody></table></div></>
}

function PharmacyOrders({ orders, onApprove, onReject }) {
  const [busy, setBusy] = useState('')
  const [dismissedOrderIds, setDismissedOrderIds] = useState([])
  const visibleOrders = orders.filter((o) => !dismissedOrderIds.includes(o.id))
  const pendingOrdersCount = visibleOrders.filter((o) => o.status === 'pending').length
  const dismissOrder = (id) => setDismissedOrderIds((prev) => [...prev, id])
  const run = async (fn, id) => { setBusy(id); await fn(id); setBusy('') }
  return (
    <>
      <h1 className="dash-title">Orders</h1>
      {pendingOrdersCount > 0 ? <p className="form-hint">New orders waiting: {pendingOrdersCount}</p> : null}
      {!visibleOrders.length ? <p className="form-hint">No orders to show.</p> : null}
      <div className="card-grid card-grid--medicines">{visibleOrders.map((o) => <article className="form-panel pharmacy-order-card" key={o.id}><div className="pharmacy-order-card__top"><h2>Order #{String(o.id).slice(-6)}</h2>{o.status !== 'pending' ? <button type="button" className="pharmacy-order-card__close" aria-label="Remove old order" onClick={() => dismissOrder(o.id)}>x</button> : null}</div><p className="form-hint">Status: {o.status}</p>{o.items.map((i) => <p key={`${i.medicineId}-${i.status}`}>{i.medicineName} · Qty {i.quantity} · {i.status}</p>)}{o.status === 'pending' ? <div className="table-actions"><button className="btn btn--primary btn--sm" disabled={busy === o.id} onClick={() => run(onApprove, o.id)}>Approve</button><button className="btn btn--danger btn--sm btn--danger-solid" disabled={busy === o.id} onClick={() => run(onReject, o.id)}>Decline</button></div> : null}</article>)}</div>
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
          <Link to="/" className="btn btn--outline btn--sm">Public site</Link>
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

  useEffect(() => { loadPublic() }, [])
  useEffect(() => { loadInventory(); loadOrders() }, [token, currentUser?.role, currentUser?.pharmacyApprovalStatus])
  useEffect(() => {
    if (!token || currentUser?.role !== 'pharmacy') return undefined
    if (currentUser?.pharmacyApprovalStatus && currentUser.pharmacyApprovalStatus !== 'approved') return undefined
    const i = setInterval(loadOrders, 5000)
    return () => clearInterval(i)
  }, [token, currentUser?.role, currentUser?.pharmacyApprovalStatus])

  const addMed = async (p) => { await medicineApi.create(p, token); await Promise.all([loadPublic(), loadInventory()]) }
  const updMed = async (id, f, v) => { await medicineApi.update(id, { [f]: v }, token); await Promise.all([loadPublic(), loadInventory()]) }
  const delMed = async (id) => { await medicineApi.remove(id, token); await Promise.all([loadPublic(), loadInventory()]) }
  const approve = async (id) => {
    try {
      await orderApi.approveForPharmacy(id, token)
      notify('Order approved successfully.')
      await Promise.all([loadOrders(), loadPublic(), loadInventory()])
    } catch (e) {
      notify(e.message || 'Failed to approve order.')
    }
  }
  const reject = async (id) => {
    try {
      await orderApi.rejectForPharmacy(id, token)
      notify('Order declined successfully.')
      await Promise.all([loadOrders(), loadPublic(), loadInventory()])
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
      <Route path="/payment/callback" element={<CustomerRoute><PublicLayout><PaymentCallback /></PublicLayout></CustomerRoute>} />
      <Route path="/pharmacy-pending" element={<PharmacyPendingRoute><PublicLayout><PharmacyPendingPage /></PublicLayout></PharmacyPendingRoute>} />
      <Route path="/pharmacy-location" element={<PharmacyLocationRoute><PublicLayout><PharmacyLocationPage /></PublicLayout></PharmacyLocationRoute>} />
      <Route path="/admin" element={<AdminRoute><PublicLayout><AdminPage /></PublicLayout></AdminRoute>} />

      <Route path="/pharmacy-dashboard" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<DashboardHome inventory={inventory} orders={orders} />} /></Route>
      <Route path="/pharmacy-orders" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<PharmacyOrders orders={orders} onApprove={approve} onReject={reject} />} /></Route>
      <Route path="/inventory" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Inventory inventory={inventory} onUpdate={updMed} onDelete={delMed} />} /></Route>
      <Route path="/add-medicine" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<AddMedicine onAdd={addMed} />} /></Route>
      <Route path="/pharmacy-profile" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Profile />} /></Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
