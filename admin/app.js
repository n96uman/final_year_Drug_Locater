const STORAGE_KEY = 'admin_session'
const THEME_KEY = 'admin_theme'

function $(sel) {
  return document.querySelector(sel)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY)
}

function setTheme(next) {
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(THEME_KEY, next)
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  setTheme(saved || (preferredDark ? 'dark' : 'light'))
}

function renderLogin() {
  const app = $('#app')
  const logoutBtn = $('#logoutBtn')
  logoutBtn.hidden = true

  app.innerHTML = `
    <section class="grid">
      <div class="col-12">
        <div class="card">
          <div class="card__header">
            <div>
              <h1 style="margin:0;font-size:20px">Sign in</h1>
              <p class="muted" style="margin:6px 0 0">UI-only login (no backend yet).</p>
            </div>
            <span class="pill"><span class="dot dot--warn"></span>Offline mode</span>
          </div>
          <div class="card__body">
            <div class="notice" style="margin-bottom:14px">
              This page does not validate credentials. It only stores a temporary session flag in <code>sessionStorage</code>.
            </div>
            <form id="loginForm" class="form" autocomplete="off">
              <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required placeholder="admin@example.com" />
              </div>
              <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" required placeholder="••••••••" />
              </div>
              <button class="btn btn--primary btn--block" type="submit">Continue</button>
              <p id="loginMsg" class="muted" style="margin:0"></p>
            </form>
          </div>
        </div>
      </div>
    </section>
  `

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') || '').trim()
    setSession({ email, createdAt: Date.now() })
    $('#loginMsg').textContent = 'Signed in (local session).'
    render()
  })
}

function renderDashboard(session) {
  const app = $('#app')
  const logoutBtn = $('#logoutBtn')
  logoutBtn.hidden = false

  const now = new Date()
  const sample = [
    { id: 'USR-1021', action: 'User registered', status: 'ok', at: now.toLocaleString() },
    { id: 'MED-233', action: 'Medicine added', status: 'ok', at: now.toLocaleString() },
    { id: 'ORD-774', action: 'Order pending', status: 'warn', at: now.toLocaleString() },
  ]

  app.innerHTML = `
    <section class="grid">
      <div class="col-12">
        <div class="card">
          <div class="card__header">
            <div>
              <h1 style="margin:0;font-size:20px">Dashboard</h1>
              <p class="muted" style="margin:6px 0 0">Signed in as <strong>${escapeHtml(session.email || 'unknown')}</strong></p>
            </div>
            <span class="pill"><span class="dot dot--ok"></span>UI ready</span>
          </div>
          <div class="card__body">
            <div class="grid" style="margin-bottom: 14px">
              <div class="col-3"><div class="kpi"><div class="kpi__label">Users</div><div class="kpi__value">—</div><div class="muted" style="font-size:12px;margin-top:6px">Connect backend later</div></div></div>
              <div class="col-3"><div class="kpi"><div class="kpi__label">Pharmacies</div><div class="kpi__value">—</div><div class="muted" style="font-size:12px;margin-top:6px">Connect backend later</div></div></div>
              <div class="col-3"><div class="kpi"><div class="kpi__label">Medicines</div><div class="kpi__value">—</div><div class="muted" style="font-size:12px;margin-top:6px">Connect backend later</div></div></div>
              <div class="col-3"><div class="kpi"><div class="kpi__label">Orders</div><div class="kpi__value">—</div><div class="muted" style="font-size:12px;margin-top:6px">Connect backend later</div></div></div>
            </div>

            <div class="notice" style="margin-bottom: 14px">
              Next step when you’re ready: replace the sample table below with real API calls (but you asked to keep it disconnected for now).
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width: 140px">Ref</th>
                    <th>Event</th>
                    <th style="width: 130px">Status</th>
                    <th style="width: 200px">Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${sample
                    .map((r) => {
                      const label = r.status === 'ok' ? 'OK' : 'Pending'
                      return `<tr>
                        <td><strong>${escapeHtml(r.id)}</strong></td>
                        <td>${escapeHtml(r.action)}</td>
                        <td><span class="pill"><span class="dot ${r.status === 'ok' ? 'dot--ok' : 'dot--warn'}"></span>${label}</span></td>
                        <td class="muted">${escapeHtml(r.at)}</td>
                      </tr>`
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
}

function render() {
  const session = getSession()
  if (!session) return renderLogin()
  renderDashboard(session)
}

function main() {
  initTheme()

  $('#themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light'
    setTheme(current === 'dark' ? 'light' : 'dark')
  })

  $('#logoutBtn').addEventListener('click', () => {
    clearSession()
    render()
  })

  render()
}

main()

