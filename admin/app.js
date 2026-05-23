const STORAGE_KEY = "dl_admin_session"
const THEME_KEY = "admin_theme"
const API_BASE = (window.ADMIN_API_BASE || "/api").replace(/\/+$/, "")

function $(sel) { return document.querySelector(sel) }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }

function getSession() {
  try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function setSession(session) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)) }
function clearSession() { sessionStorage.removeItem(STORAGE_KEY) }

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`)
  return data
}

function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next)
  localStorage.setItem(THEME_KEY, next)
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  const preferredDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  setTheme(saved || (preferredDark ? "dark" : "light"))
}

function renderLogin() {
  $("#logoutBtn").hidden = true
  $("#app").innerHTML = `
    <section class="grid"><div class="col-12"><div class="card">
      <div class="card__header"><div><h1 style="margin:0;font-size:20px">Admin sign in</h1>
      <p class="muted" style="margin:6px 0 0">Use your admin account (email: admin).</p></div></div>
      <div class="card__body">
        <form id="loginForm" class="form">
          <div class="field"><label for="email">Email</label><input id="email" name="email" required /></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required /></div>
          <label class="terms-check"><input type="checkbox" id="acceptTerms" required /> I accept the terms and conditions</label>
          <button class="btn btn--primary btn--block" type="submit">Sign in</button>
          <p id="loginMsg" class="muted" style="margin:0"></p>
        </form>
      </div>
    </div></div></section>`
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
  const msg = $("#loginMsg")
    msg.textContent = "Signing in…"
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { email: fd.get("email"), password: fd.get("password"), acceptTerms: $("#acceptTerms").checked },
      })
      if (data.user.role !== "admin") throw new Error("This account is not an administrator.")
      setSession({ token: data.token, user: data.user })
      render()
    } catch (err) {
      msg.textContent = err.message || "Login failed"
    }
  })
}

let currentTab = "pending"

async function loadLicenseThumb(userId, token) {
  const res = await fetch(`${API_BASE}/admin/pharmacies/${userId}/license-image`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}

async function renderDashboard(session) {
  $("#logoutBtn").hidden = false
  const app = $("#app")
  app.innerHTML = `<p class="muted">Loading…</p>`
  try {
    const [statsRes, listRes] = await Promise.all([
      api("/admin/stats", { token: session.token }),
      api(`/admin/pharmacies?status=${currentTab}`, { token: session.token }),
    ])
    const s = statsRes.stats
    const list = listRes.pharmacies || []
    app.innerHTML = `
      <section class="grid"><div class="col-12"><div class="card">
        <div class="card__header"><div><h1 style="margin:0;font-size:20px">Admin dashboard</h1>
        <p class="muted" style="margin:6px 0 0">Signed in as <strong>${escapeHtml(session.user.email)}</strong></p></div></div>
        <div class="card__body">
          <div class="grid" style="margin-bottom:14px">
            <div class="col-3"><div class="kpi"><div class="kpi__label">Pending</div><div class="kpi__value">${s.pendingPharmacies}</div></div></div>
            <div class="col-3"><div class="kpi"><div class="kpi__label">Approved</div><div class="kpi__value">${s.approvedPharmacies}</div></div></div>
            <div class="col-3"><div class="kpi"><div class="kpi__label">Customers</div><div class="kpi__value">${s.customers}</div></div></div>
            <div class="col-3"><div class="kpi"><div class="kpi__label">Orders</div><div class="kpi__value">${s.orders}</div></div></div>
          </div>
          <div class="tabs" style="margin-bottom:12px">
            ${["pending","approved","rejected"].map((t) => `<button type="button" class="btn btn--sm ${currentTab===t?"btn--primary":"btn--ghost"}" data-tab="${t}">${t}</button>`).join("")}
          </div>
          <div id="pharmacyList"></div>
        </div>
      </div></div></section>`
    app.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => { currentTab = btn.dataset.tab; render() }))
    const listEl = $("#pharmacyList")
    if (!list.length) { listEl.innerHTML = `<p class="muted">No ${currentTab} pharmacies.</p>`; return }
    listEl.innerHTML = list.map((p) => `
      <article class="card" style="margin-bottom:12px;padding:12px">
        <h2 style="margin:0 0 6px;font-size:16px">${escapeHtml(p.name)}</h2>
        <p class="muted">${escapeHtml(p.email)}</p>
        <p class="muted">${p.location ? escapeHtml(p.location) : "No location"}</p>
        <div data-licence="${p.id}" class="muted">Licence: ${p.hasLicense ? "loading…" : "none"}</div>
        ${currentTab === "pending" ? `<div style="margin-top:10px;display:flex;gap:8px">
          <button type="button" class="btn btn--primary btn--sm" data-approve="${p.id}">Approve</button>
          <button type="button" class="btn btn--danger btn--sm" data-reject="${p.id}">Reject</button>
        </div>` : ""}
      </article>`).join("")
    for (const p of list) {
      if (!p.hasLicense) continue
      const holder = listEl.querySelector(`[data-licence="${p.id}"]`)
      const url = await loadLicenseThumb(p.id, session.token)
      if (url && holder) holder.innerHTML = `<a href="${url}" target="_blank" rel="noreferrer"><img src="${url}" alt="Licence" style="max-width:100%;max-height:160px;border-radius:8px;margin-top:6px" /></a>`
    }
    listEl.querySelectorAll("[data-approve]").forEach((btn) => btn.addEventListener("click", async () => {
      await api(`/admin/pharmacies/${btn.dataset.approve}/approve`, { method: "PUT", token: session.token })
      render()
    }))
    listEl.querySelectorAll("[data-reject]").forEach((btn) => btn.addEventListener("click", async () => {
      await api(`/admin/pharmacies/${btn.dataset.reject}/reject`, { method: "PUT", token: session.token })
      render()
    }))
  } catch (err) {
    app.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`
  }
}

function render() {
  const session = getSession()
  if (!session) return renderLogin()
  return renderDashboard(session)
}

function main() {
  initTheme()
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light"
    setTheme(current === "dark" ? "light" : "dark")
  })
  $("#logoutBtn").addEventListener("click", () => { clearSession(); render() })
  render()
}
main()
