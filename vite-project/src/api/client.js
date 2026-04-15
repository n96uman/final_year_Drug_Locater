const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const apiBaseCandidates = [
  configuredBaseUrl,
  'http://localhost:5000/api',
  'http://127.0.0.1:5000/api',
].filter(Boolean)
const uniqueApiBaseCandidates = [...new Set(apiBaseCandidates.map((u) => u.replace(/\/+$/, '')))]

async function parseResponse(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text }
  }
}

async function requestWithBase(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const data = await parseResponse(response)
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  return data
}

async function runRequest(path, init) {
  let lastError = null
  for (const baseUrl of uniqueApiBaseCandidates) {
    try {
      return await requestWithBase(baseUrl, path, init)
    } catch (error) {
      lastError = error
      // Try next local candidate only on network-like failures.
      const msg = String(error?.message || '')
      const isNetworkIssue =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('Load failed')
      if (!isNetworkIssue) break
    }
  }
  throw lastError || new Error('Unable to connect to API server.')
}

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  return runRequest(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function apiFetchMultipart(path, { method = 'POST', formData, token } = {}) {
  return runRequest(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
}

export const authApi = {
  register: (formData) => apiFetchMultipart('/auth/register', { method: 'POST', formData }),
  login: (payload) => apiFetch('/auth/login', { method: 'POST', body: payload }),
  me: (token) => apiFetch('/auth/me', { token }),
  updateProfile: (formData, token) => apiFetchMultipart('/auth/profile', { method: 'PUT', formData, token }),
}

export const medicineApi = {
  list: () => apiFetch('/medicines'),
  listMine: (token) => apiFetch('/medicines/mine', { token }),
  create: (payload, token) => apiFetch('/medicines', { method: 'POST', body: payload, token }),
  update: (id, payload, token) => apiFetch(`/medicines/${id}`, { method: 'PUT', body: payload, token }),
  remove: (id, token) => apiFetch(`/medicines/${id}`, { method: 'DELETE', token }),
}

export const orderApi = {
  checkout: (payload, token) => apiFetch('/orders', { method: 'POST', body: payload, token }),
  listMine: (token) => apiFetch('/orders/mine', { token }),
  listPharmacy: (token) => apiFetch('/orders/pharmacy', { token }),
  approveForPharmacy: (id, token) => apiFetch(`/orders/${id}/approve`, { method: 'PUT', token }),
  rejectForPharmacy: async (id, token) => {
    try {
      return await apiFetch(`/orders/${id}/reject`, { method: 'PUT', token })
    } catch (e) {
      return apiFetch(`/orders/${id}/decline`, { method: 'PUT', token })
    }
  },
}
