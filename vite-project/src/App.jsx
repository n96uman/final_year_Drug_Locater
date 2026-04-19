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
import { medicineApi, orderApi } from './api/client'

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
  if (currentUser.role !== 'customer') return <Navigate to="/pharmacy-dashboard" replace />
  return children
}

function PharmacyRoute({ children }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) return <p className="form-hint">Loading profile...</p>
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'pharmacy') return <Navigate to="/" replace />
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
        <aside className="hero__visual" aria-hidden="true"><div className="hero__visual-inner"><strong>Smart search</strong><span>Compare prices · Build your cart</span></div></aside>
      </section>
      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="section-title">Featured medicines</h2>
        {loading ? <p className="form-hint">Loading medicines from database...</p> : null}
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
      {loading ? <p className="form-hint">Loading medicines from database...</p> : null}
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
      {loading ? <p className="form-hint">Loading pharmacies from database...</p> : null}
      {!loading && error ? <p className="form-hint">{error}</p> : null}
      {!loading && !error && medicines.length === 0 ? <p className="form-hint">No pharmacy medicines available right now.</p> : null}
      {!loading && !error ? <section><div className="card-grid card-grid--medicines">{medicines.map((m) => <PharmacyCard key={m._id || m.id} medicine={m} onAddToCart={addToCart} />)}</div></section> : null}
    </>
  )
}

function CartPage() {
  const { cartItems, cartStatus, orderHistory, removeFromCart, updateQuantity, checkout, checkoutLoading, checkPendingOrderStatus, subtotal, delivery, total } = useCart()
  useEffect(() => {
    if (cartStatus !== 'waiting') return
    checkPendingOrderStatus()
    const t = setInterval(checkPendingOrderStatus, 5000)
    return () => clearInterval(t)
  }, [cartStatus, checkPendingOrderStatus])

  return (
    <>
      <header className="page-header"><h1>Shopping cart</h1><p>Status: {cartStatus === 'waiting' ? 'Waiting pharmacy approval' : 'Ready to checkout'}</p></header>
      <div className="cart-layout">
        <div className="cart-table-wrap">
          {cartItems.length ? (
            <table className="cart-table"><thead><tr><th>Medicine name</th><th>Pharmacy name</th><th>Price</th><th>Quantity</th><th>Action</th></tr></thead><tbody>{cartItems.map((i) => <CartItem key={i._id || i.id} item={i} onRemove={removeFromCart} onUpdateQuantity={updateQuantity} />)}</tbody></table>
          ) : <div className="cart-empty"><p>Your cart is empty.</p><Link to="/search" className="btn btn--outline">Find medicines</Link></div>}
        </div>
        <aside className="cart-summary"><h2>Order summary</h2><div className="cart-summary__row"><span>Subtotal</span><span>{subtotal} ETB</span></div><div className="cart-summary__row"><span>Delivery</span><span>{delivery} ETB</span></div><div className="cart-summary__row cart-summary__row--total"><span>Total price</span><span>{total} ETB</span></div><button type="button" className="btn btn--primary btn--block cart-checkout-spacer" disabled={checkoutLoading || cartStatus === 'waiting' || cartItems.length === 0} onClick={checkout}>{checkoutLoading ? 'Processing' : 'Checkout'}</button></aside>
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
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const submit = async (e) => {
    e.preventDefault()
    const r = await login({ email, password })
    if (!r.ok) return setErr(r.message)
    nav(r.user.role === 'pharmacy' ? '/pharmacy-dashboard' : (loc.state?.from || '/'))
  }
  return <div className="page-inner page-inner--narrow"><header className="page-header"><h1>Login</h1></header><section className="form-panel"><form onSubmit={submit}><div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div className="form-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div><button className="btn btn--primary btn--block">Sign in</button>{err ? <p className="form-hint">{err}</p> : null}</form><div className="auth-alt"><p className="auth-alt__label">New to E-Pharmacy?</p><Link to="/register" state={{ fromLogin: true }} className="btn btn--outline btn--block">Sign up</Link></div></section></div>
}

function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' })
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const submit = async (e) => {
    e.preventDefault()
    const r = await register({ ...form, profileFile: file })
    if (!r.ok) return setErr(r.message)
    nav(r.user.role === 'pharmacy' ? '/pharmacy-dashboard' : '/')
  }
  return <div className="page-inner page-inner--narrow"><header className="page-header"><h1>Create account</h1></header><section className="form-panel"><form onSubmit={submit}><div className="form-group"><label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div><div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div><div className="form-group"><label>Register as</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="customer">customer</option><option value="pharmacy">pharmacy</option></select></div><div className="form-group"><label>Profile picture</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div><button className="btn btn--primary btn--block">Create account</button>{err ? <p className="form-hint">{err}</p> : null}</form></section></div>
}

function Profile() {
  const { currentUser, authLoading, refreshProfile, updateProfile, logout } = useAuth()
  const nav = useNavigate()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(currentUser?.name || '')
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { refreshProfile() }, [])
  useEffect(() => { setName(currentUser?.name || '') }, [currentUser?.name])
  if (authLoading) return <section className="form-panel form-panel--wide"><p className="form-hint">Loading profile...</p></section>
  if (!currentUser) return <section className="form-panel form-panel--wide"><p className="form-hint">Profile not found. Please login again.</p></section>
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const r = await updateProfile({ name, profileFile: file })
    if (!r.ok) {
      setSaving(false)
      return setMsg(r.message)
    }
    setMsg('Saved')
    setFile(null)
    setEdit(false)
    setSaving(false)
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
        </div>
      </div>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input value={name} disabled={!edit} onChange={(e) => setName(e.target.value)} /></div>
        {edit ? <div className="form-group"><label>Profile picture</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div> : null}
        {edit ? <button className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button> : <p className="form-hint">Tap the edit icon on your photo to update profile.</p>}
      </form>
      <p className="form-hint">{msg}</p>
      <button className="btn btn--danger" onClick={() => { logout(); nav('/login') }}>Logout</button>
    </section>
  )
}

function PharmacyLayout({ activeOrdersCount }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header site-header--portal"><div className="header-inner header-inner--portal"><p className="site-title"><Link to="/pharmacy-dashboard">E-Pharmacy<span>Pharmacy portal · Hawassa</span></Link></p><span className="portal-badge">Active orders {activeOrdersCount}</span></div></header>
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
      <p className="dash-subtitle">Overview of your medicines and order flow.</p>
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
      setPublicError('Could not fetch medicines. Please check backend server and try again.')
    } finally {
      setPublicLoading(false)
    }
  }
  const loadInventory = async () => { if (!token || currentUser?.role !== 'pharmacy') return setInventory([]); try { const d = await medicineApi.listMine(token); setInventory(d.medicines || []) } catch { setInventory([]) } }
  const loadOrders = async () => { if (!token || currentUser?.role !== 'pharmacy') return setOrders([]); try { const d = await orderApi.listPharmacy(token); setOrders(d.orders || []) } catch { setOrders([]) } }

  useEffect(() => { loadPublic() }, [])
  useEffect(() => { loadInventory(); loadOrders() }, [token, currentUser?.role])
  useEffect(() => { if (!token || currentUser?.role !== 'pharmacy') return; const i = setInterval(loadOrders, 5000); return () => clearInterval(i) }, [token, currentUser?.role])

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

      <Route path="/pharmacy-dashboard" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<DashboardHome inventory={inventory} orders={orders} />} /></Route>
      <Route path="/pharmacy-orders" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<PharmacyOrders orders={orders} onApprove={approve} onReject={reject} />} /></Route>
      <Route path="/inventory" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Inventory inventory={inventory} onUpdate={updMed} onDelete={delMed} />} /></Route>
      <Route path="/add-medicine" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<AddMedicine onAdd={addMed} />} /></Route>
      <Route path="/pharmacy-profile" element={<PharmacyRoute><PharmacyLayout activeOrdersCount={activeOrdersCount} /></PharmacyRoute>}><Route index element={<Profile />} /></Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
